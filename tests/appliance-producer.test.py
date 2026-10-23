"""Focused producer invariants without downloading or building a Linux image."""
import importlib.util
import json
import io
import os
import sys
import shutil
from pathlib import Path
import tempfile
import tarfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/appliance'))
from failure import write_failure
from enrollment import derive_enrollment, FORK_ENDPOINTS
from archive_identity import Inventory
module = importlib.util.spec_from_file_location('appliance_prepare', ROOT / 'scripts/appliance/prepare.py')
producer = importlib.util.module_from_spec(module)
module.loader.exec_module(producer)
control_spec = importlib.util.spec_from_file_location('appliance_control', ROOT / 'scripts/appliance/control-appliance.py')
controller = importlib.util.module_from_spec(control_spec)
control_spec.loader.exec_module(controller)
setup_spec = importlib.util.spec_from_file_location('appliance_runtime_setup', ROOT / 'scripts/appliance/runtime-setup.py')
runtime_setup = importlib.util.module_from_spec(setup_spec)
setup_spec.loader.exec_module(runtime_setup)


class ProducerTests(unittest.TestCase):
    def sanitized_path(self, value):
        import subprocess
        script = (ROOT / 'scripts/appliance/linux-build-path.sh').read_text()
        if os.name == 'posix':
            command = ['/bin/bash', '-s']
        else:
            # Use the already installed Git shell, never a WSL distro or build.
            executable = shutil.which('git')
            candidates = [Path(executable).resolve().parents[1] / 'bin/bash.exe', Path(executable).resolve().parent / 'bash.exe'] if executable else []
            shell = next((path for path in candidates if path.is_file()), None)
            if shell is None:
                self.skipTest('A local POSIX shell is unavailable for the isolated PATH check')
            command = [str(shell), '-s']
        original = os.environ.get('PATH')
        input_text = "PATH='" + value + "'\n" + script + "\nprintf '%s' \"$PATH\"\n"
        result = subprocess.run(command, input=input_text, text=True, capture_output=True, timeout=10, check=True)
        self.assertEqual(os.environ.get('PATH'), original)
        return result.stdout

    def test_worker_path_preserves_custom_absolute_linux_toolchains(self):
        actual = self.sanitized_path('/opt/cross/bin:/home/builder/bin:/usr/bin')
        self.assertTrue(actual.startswith('/opt/cross/bin:/home/builder/bin:/usr/bin:'))
        self.assertTrue(actual.endswith('/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'))

    def test_worker_path_rejects_whitespace_relative_and_mounted_drive_entries(self):
        actual = self.sanitized_path('/opt/my tools:/opt/tab\ttools:relative::/mnt/c/Program Files/tool:/mnt/c/tools:/mnt/c:/mnt/D/bin:/safe/bin')
        self.assertEqual(actual, '/safe/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')
    def spec(self):
        return {'version': 1, 'name': 'test-os', 'mode': 'console', 'persistence': True,
                'source': {'kind': 'registry', 'image': 'example/app:1'}, 'tunnel': {'mode': 'off'}}

    def test_valid_plan(self):
        self.assertEqual(producer.validate(self.spec())['name'], 'test-os')

    def test_console_accepts_no_http_target(self):
        spec = self.spec()
        spec['kioskUrl'] = ''
        self.assertEqual(producer.validate(spec)['kioskUrl'], '')

    def test_external_endpoint_cannot_supply_local_health_proof(self):
        spec = self.spec()
        spec['kioskUrl'] = 'https://example.com/'
        with self.assertRaises(ValueError):
            producer.validate(spec)

    @unittest.skipUnless(os.name == 'posix' and hasattr(os, 'getuid'), 'Linux process ownership checks require POSIX getuid and procfs')
    def test_orphan_process_group_is_not_claimed_stopped(self):
        import os
        with tempfile.TemporaryDirectory() as temp:
            receipt = Path(temp) / 'process.json'
            record = {'pid': 123, 'pgid': 123, 'starttime': '42', 'uid': os.getuid()}
            receipt.write_text(json.dumps(record))
            with patch.object(controller, 'identity', return_value=None), patch.object(controller, 'members', return_value=[record]), patch.object(controller.os, 'killpg') as kill:
                self.assertEqual(controller.control(receipt, 'cancel')['state'], 'identity-mismatch')
                kill.assert_not_called()
            with patch.object(controller, 'identity', return_value=None), patch.object(controller, 'members', return_value=[]):
                self.assertEqual(controller.control(receipt, 'status')['state'], 'verified-stopped')

    def archive(self, path, tag):
        import hashlib
        config = json.dumps({'os': 'linux', 'architecture': 'amd64'}).encode()
        digest = hashlib.sha256(config).hexdigest()
        manifest = json.dumps([{'Config': digest + '.json', 'RepoTags': [tag], 'Layers': []}]).encode()
        with tarfile.open(path, 'w') as archive:
            for name, data in [('manifest.json', manifest), (digest + '.json', config)]:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return 'sha256:' + digest

    def test_archive_cannot_select_an_unrelated_engine_image(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'selected.tar'
            self.archive(archive, 'other/app:1')
            identities, digest = producer.admit_archive(archive, root / 'snapshot.tar')
            # Even an available preexisting engine image cannot authorize this request.
            with patch.object(producer, 'run', return_value=json.dumps([{'Id': 'sha256:preexisting'}]).encode()) as command:
                with self.assertRaisesRegex(ValueError, 'does not belong'):
                    producer.load_admitted_archive(root / 'snapshot.tar', identities, ['host-only/private:1'], digest)
                command.assert_not_called()

    def test_archive_loaded_identity_must_match_config_digest(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'selected.tar'
            expected = self.archive(archive, 'selected/app:1')
            identities, digest = producer.admit_archive(archive, root / 'snapshot.tar')
            replies = [json.dumps([{'Id': expected}]).encode(), b'', json.dumps([{'Id': 'sha256:wrong'}]).encode()]
            with patch.object(producer, 'run', side_effect=replies):
                with self.assertRaisesRegex(ValueError, 'differs'):
                    producer.load_admitted_archive(root / 'snapshot.tar', identities, ['selected/app:1'], digest)

    def test_archive_duplicate_metadata_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'selected.tar'
            self.archive(archive, 'selected/app:1')
            with tarfile.open(archive, 'a') as file:
                duplicate = tarfile.TarInfo('manifest.json')
                duplicate.size = 2
                file.addfile(duplicate, io.BytesIO(b'[]'))
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                producer.admit_archive(archive, root / 'snapshot.tar')

    def test_docker_save_oci_hybrid_configuration_paths_are_supported(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'hybrid.tar'
            config = json.dumps({'os': 'linux', 'architecture': 'amd64'}).encode()
            digest = hashlib.sha256(config).hexdigest()
            entries = {'manifest.json': json.dumps([{'Config': 'blobs/sha256/' + digest, 'RepoTags': ['example/hybrid:1'], 'Layers': []}]).encode(),
                       'blobs/sha256/' + digest: config, 'oci-layout': b'{"imageLayoutVersion":"1.0.0"}',
                       'index.json': b'{"schemaVersion":2,"manifests":[]}'}
            with tarfile.open(archive, 'w') as file:
                for name, content in entries.items():
                    member = tarfile.TarInfo(name)
                    member.size = len(content)
                    file.addfile(member, io.BytesIO(content))
            identities = producer.inspect_archive(archive)
            self.assertEqual(identities['example/hybrid:1'], 'sha256:' + digest)

    def test_pure_oci_archive_reports_explicit_unsupported_format(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / 'oci.tar'
            with tarfile.open(archive, 'w') as file:
                member = tarfile.TarInfo('oci-layout')
                member.size = 2
                file.addfile(member, io.BytesIO(b'{}'))
            with self.assertRaises(ValueError) as failure:
                producer.inspect_archive(archive)
            self.assertEqual(producer.safe_diagnostic(failure.exception)[0], 'ARCHIVE_FORMAT_UNSUPPORTED')

    def oci_graph_archive(self, path, corrupt_layer=False, wrong_diff=False):
        import gzip
        import hashlib
        def digest(content):
            return 'sha256:' + hashlib.sha256(content).hexdigest()
        layer_stream = io.BytesIO()
        with tarfile.open(fileobj=layer_stream, mode='w') as layer:
            member = tarfile.TarInfo('fixture.txt')
            member.size = 7
            layer.addfile(member, io.BytesIO(b'fixture'))
        uncompressed = layer_stream.getvalue()
        compressed = gzip.compress(uncompressed, mtime=0)
        config = json.dumps({'os': 'linux', 'architecture': 'amd64', 'rootfs': {'type': 'layers', 'diff_ids': ['sha256:' + 'f' * 64 if wrong_diff else digest(uncompressed)]}}).encode()
        config_id = digest(config)
        layer_id = digest(compressed)
        manifest = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json',
            'config': {'mediaType': 'application/vnd.oci.image.config.v1+json', 'digest': config_id, 'size': len(config)},
            'layers': [{'mediaType': 'application/vnd.oci.image.layer.v1.tar+gzip', 'digest': layer_id, 'size': len(compressed)}]}).encode()
        manifest_id = digest(manifest)
        inner = json.dumps({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json',
            'manifests': [{'mediaType': 'application/vnd.oci.image.manifest.v1+json', 'digest': manifest_id, 'size': len(manifest), 'platform': {'os': 'linux', 'architecture': 'amd64'}}]}).encode()
        index_id = digest(inner)
        outer = {'schemaVersion': 2, 'manifests': [{'mediaType': 'application/vnd.oci.image.index.v1+json', 'digest': index_id, 'size': len(inner)}]}
        entries = {'manifest.json': json.dumps([{'Config': 'blobs/sha256/' + config_id[7:], 'RepoTags': ['example/graph:1'], 'Layers': ['blobs/sha256/' + layer_id[7:]]}]).encode(),
                   'index.json': json.dumps(outer).encode(), 'oci-layout': b'{"imageLayoutVersion":"1.0.0"}',
                   'blobs/sha256/' + config_id[7:]: config, 'blobs/sha256/' + layer_id[7:]: compressed[:-1] + b'X' if corrupt_layer else compressed,
                   'blobs/sha256/' + manifest_id[7:]: manifest, 'blobs/sha256/' + index_id[7:]: inner}
        with tarfile.open(path, 'w') as archive:
            for name, content in entries.items():
                member = tarfile.TarInfo(name)
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
        return config_id, manifest_id, index_id

    def test_containerd_manifest_and_index_ids_bind_to_saved_configuration(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'graph.tar'
            config_id, manifest_id, index_id = self.oci_graph_archive(path)
            inventory = producer.inspect_archive(path)
            self.assertEqual(inventory['example/graph:1'], config_id)
            self.assertTrue(inventory.matches('example/graph:1', manifest_id))
            self.assertTrue(inventory.matches('example/graph:1', index_id))
            self.assertFalse(inventory.matches('example/graph:1', 'sha256:' + 'a' * 64))
            # The previous simple equality invariant rejects this valid graph.
            self.assertNotEqual(inventory['example/graph:1'], index_id)

    def test_oci_layer_content_and_uncompressed_configuration_chain_are_verified(self):
        for options in ({'corrupt_layer': True}, {'wrong_diff': True}):
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                path = Path(temp) / 'graph.tar'
                self.oci_graph_archive(path, **options)
                with self.assertRaises(ValueError):
                    producer.inspect_archive(path)

    def test_saved_representation_failure_has_a_distinct_safe_code(self):
        failure = producer.SavedImageIdentityMismatch('internal detail excluded')
        self.assertEqual(producer.safe_diagnostic(failure), ('SAVED_IMAGE_IDENTITY_MISMATCH', 'python3', 1))

    def enrollment_fixture(self):
        import copy
        reference = 'material-buildroot/prepared:fixture'
        prepared = {'image': reference, 'sourceRevision': 'a' * 40, 'endpoints': copy.deepcopy(FORK_ENDPOINTS)}
        compose = {'services': {'initialize': {'image': reference, 'volumes': [{'type': 'volume', 'source': 'owner-config', 'target': '/run/owner'}]}}, 'volumes': {'owner-config': {}}}
        inventory = Inventory()
        inventory[reference] = 'sha256:' + 'b' * 64
        inventory.configurations[inventory[reference]] = {'config': {'Labels': {'org.opencontainers.image.revision': 'a' * 40}}}
        return prepared, compose, inventory

    def test_enrollment_is_derived_from_admitted_workload_configuration(self):
        prepared, compose, inventory = self.enrollment_fixture()
        result = derive_enrollment(prepared, 'job-2027-fork', compose, inventory, FORK_ENDPOINTS['productiveUrl'])
        self.assertEqual(result, {'composeProject': 'material-appliance', 'service': 'initialize', 'volume': 'owner-config',
            'imageId': 'sha256:' + 'b' * 64, 'sourceRevision': 'a' * 40,
            'productiveUrl': 'https://127.0.0.1:8443/', 'setupOrigin': 'https://127.0.0.1:8444/'})

    def test_enrollment_is_unavailable_for_missing_or_mismatched_receipts(self):
        prepared, compose, inventory = self.enrollment_fixture()
        self.assertIsNone(derive_enrollment(None, 'job-2027-fork', compose, inventory, FORK_ENDPOINTS['productiveUrl']))
        self.assertIsNone(derive_enrollment(prepared, 'home-assistant-material', compose, inventory, FORK_ENDPOINTS['productiveUrl']))
        self.assertIsNone(derive_enrollment(prepared, 'job-2027-fork', compose, inventory, 'https://127.0.0.1:8444/'))
        prepared['sourceRevision'] = 'c' * 40
        self.assertIsNone(derive_enrollment(prepared, 'job-2027-fork', compose, inventory, FORK_ENDPOINTS['productiveUrl']))

    def test_enrollment_never_adopts_an_arbitrary_or_ambiguous_owner_mount(self):
        for replacement in ([{'type': 'bind', 'source': 'owner-config', 'target': '/run/owner'}],
                            [{'type': 'volume', 'source': 'other-owner', 'target': '/run/owner'}],
                            ['owner-config:/run/owner', 'owner-config:/run/owner']):
            with self.subTest(mount=replacement):
                prepared, compose, inventory = self.enrollment_fixture()
                compose['services']['initialize']['volumes'] = replacement
                self.assertIsNone(derive_enrollment(prepared, 'job-2027-fork', compose, inventory, FORK_ENDPOINTS['productiveUrl']))

    def test_diagnostic_never_serializes_process_output_or_arguments(self):
        import subprocess
        cases = [(b'unauthorized: DO_NOT_EMIT', 'REGISTRY_AUTH_REQUIRED'),
                 (b'x509: certificate signed by unknown authority DO_NOT_EMIT', 'REGISTRY_TLS_FAILED'),
                 (b'dial tcp: no such host DO_NOT_EMIT', 'REGISTRY_NETWORK_FAILED'),
                 (b'Cannot connect to the Docker daemon DO_NOT_EMIT', 'DOCKER_DAEMON_UNAVAILABLE'),
                 (b'other failure DO_NOT_EMIT', 'DOCKER_PULL_FAILED')]
        for stderr, expected in cases:
            with self.subTest(code=expected):
                error = subprocess.CalledProcessError(1, ['DO_NOT_EMIT'], stderr=stderr)
                with patch.object(producer.subprocess, 'run', side_effect=error):
                    with self.assertRaises(producer.SafeCommandFailure) as failure:
                        producer.run('docker', 'pull', 'DO_NOT_EMIT')
                code, tool, exit_code = producer.safe_diagnostic(failure.exception)
                self.assertEqual(code, expected)
                with tempfile.TemporaryDirectory() as temp:
                    write_failure(Path(temp), 'preparing', code, tool, exit_code)
                    write_failure(Path(temp), 'preparing', 'BUILD_STEP_FAILED', 'producer', 1)
                    serialized = (Path(temp) / 'failure.json').read_text()
                    self.assertNotIn('DO_NOT_EMIT', serialized)
                    record = json.loads(serialized)
                    self.assertEqual(set(record), {'schemaVersion', 'stage', 'code', 'tool', 'exitCode'})
                    self.assertEqual(record['code'], expected)

    def test_prepared_bundle_is_offline_and_preserves_security_profile(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'image.tar'
            app_image = 'material-buildroot/prepared:fixture'
            image_id = self.archive(archive, app_image)
            # Add a second tag referencing the same synthetic configuration.
            with tarfile.open(archive, 'r') as file:
                entries = [(item, file.extractfile(item).read()) for item in file.getmembers()]
            manifest = json.loads(entries[0][1])
            manifest[0]['RepoTags'].append('postgres:18-bookworm')
            entries[0] = (entries[0][0], json.dumps(manifest).encode())
            with tarfile.open(archive, 'w') as file:
                for member, content in entries:
                    member.size = len(content)
                    file.addfile(member, io.BytesIO(content))
            bundle = root / 'bundle'
            profile = bundle / 'backend/docker/chromium-seccomp.json'
            profile.parent.mkdir(parents=True)
            profile.write_text('{"defaultAction":"SCMP_ACT_ERRNO"}')
            compose_file = bundle / 'compose.yaml'
            compose_file.write_text('services: {}\n')
            files = [{'path': str(path.relative_to(bundle)).replace('\\', '/'), 'size': path.stat().st_size,
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in (profile, compose_file)]
            prepared = root / 'prepared.json'
            prepared.write_text(json.dumps({'schemaVersion': 1, 'completeWorkload': True, 'sourceRevision': 'a' * 40,
                'image': app_image, 'imageId': image_id, 'databaseImageId': image_id, 'bundleFiles': files,
                'archive': {'size': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}}))
            here = root / 'scripts/appliance'
            here.mkdir(parents=True)
            for name in ('runtime.sh', 'kernel.fragment', 'grub.cfg', 'base_defconfig', 'kiosk.config', 'runtime-setup.py'):
                (here / name).write_bytes((ROOT / 'scripts/appliance' / name).read_bytes())
            spec = self.spec()
            spec.update(source={'kind': 'prepared'}, archivePath=str(archive), composePath=str(bundle), preparedManifestPath=str(prepared))
            spec_file = root / 'spec.json'
            spec_file.write_text(json.dumps(spec))
            compose = {'services': {'app': {'image': app_image, 'security_opt': ['no-new-privileges:true', 'seccomp=./backend/docker/chromium-seccomp.json']},
                                    'database': {'image': 'postgres:18-bookworm'}}}
            commands = []
            def command(*args):
                commands.append(args)
                if args[1:3] == ('compose', '-f'):
                    return json.dumps(compose).encode()
                if args[1:3] == ('image', 'inspect'):
                    return json.dumps([{'Id': image_id, 'Os': 'linux', 'Architecture': 'amd64', 'RepoTags': [args[-1]], 'RepoDigests': []}]).encode()
                if args[1] == 'save':
                    Path(args[3]).write_bytes(archive.read_bytes())
                return b''
            with patch.object(producer, 'run', side_effect=command):
                producer.prepare(spec_file, root / 'output', here)
            self.assertFalse(any(args[1] == 'pull' for args in commands))
            staged = root / 'output/overlay/opt/material'
            self.assertEqual((staged / 'backend/docker/chromium-seccomp.json').read_bytes(), profile.read_bytes())
            self.assertIn('seccomp=/opt/material/backend/docker/chromium-seccomp.json', (staged / 'compose.json').read_text())

    def test_registry_digest_gets_an_offline_guest_tag(self):
        import hashlib
        import subprocess
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            here = root / 'scripts/appliance'
            here.mkdir(parents=True)
            for name in ('runtime.sh', 'kernel.fragment', 'grub.cfg', 'base_defconfig', 'kiosk.config', 'runtime-setup.py'):
                (here / name).write_bytes((ROOT / 'scripts/appliance' / name).read_bytes())
            image_id = 'sha256:' + hashlib.sha256(json.dumps({'os': 'linux', 'architecture': 'amd64'}).encode()).hexdigest()
            requested = 'registry.example/app@sha256:' + 'a' * 64
            spec = self.spec()
            spec['source']['image'] = requested
            spec_file = root / 'spec.json'
            spec_file.write_text(json.dumps(spec))
            tagged = False
            def command(*args):
                nonlocal tagged
                if args[1:3] == ('image', 'inspect'):
                    if args[-1].startswith('material-buildroot/') and not tagged:
                        raise subprocess.CalledProcessError(1, ['docker', 'image', 'inspect'])
                    return json.dumps([{'Id': image_id, 'Os': 'linux', 'Architecture': 'amd64', 'RepoTags': [], 'RepoDigests': [requested]}]).encode()
                if args[1] == 'tag':
                    self.assertEqual(args[2], image_id)
                    tagged = True
                if args[1] == 'save':
                    self.archive(Path(args[3]), args[4])
                return b''
            with patch.object(producer, 'run', side_effect=command):
                producer.prepare(spec_file, root / 'output', here)
            app = root / 'output/overlay/opt/material'
            runtime = json.loads((app / 'runtime.json').read_text())
            inventory = json.loads((app / 'image-inventory.json').read_text())
            self.assertTrue(runtime['image'].startswith('material-buildroot/appliance:'))
            self.assertNotIn('@', runtime['image'])
            self.assertEqual(inventory[0]['sourceReference'], requested)
            self.assertEqual(inventory[0]['id'], image_id)

    def test_dynamic_prepared_profiles_bind_exact_reviewed_images(self):
        for adapter, references in [
            ('job-2027-upstream', ['material-buildroot/job-api:fixture', 'material-buildroot/job-frontend:fixture', 'postgres:18-bookworm']),
            ('home-assistant-material', ['material-buildroot/home-assistant:fixture'])]:
            with self.subTest(adapter=adapter):
                record = {'adapter': adapter, 'image': references[0], 'imageId': 'sha256:' + 'a' * 64,
                          'images': [{'reference': reference, 'id': 'sha256:' + 'a' * 64} for reference in references],
                          'frontendRevision': 'b' * 40,
                          'runtimeSetup': {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True} if adapter == 'job-2027-upstream' else {}}
                actual, files, identities, setup = producer.prepared_profile(record)
                self.assertEqual(actual, adapter)
                self.assertEqual(files, {'compose.yaml', 'source-receipt.json'})
                self.assertEqual(set(identities), set(references))
                record['images'].append({'reference': 'unreviewed/image:1', 'id': 'sha256:' + 'c' * 64})
                with self.assertRaises(ValueError):
                    producer.prepared_profile(record)

    def test_only_reviewed_guest_password_placeholders_are_admitted(self):
        setup = {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True}
        producer.validate_placeholders({'POSTGRES_PASSWORD': '${JOB_POSTGRES_PASSWORD:?Fresh installation password required}'}, setup)
        producer.validate_placeholders({'JOB_DATABASE_URL': 'postgresql://job_2027:${JOB_POSTGRES_PASSWORD:?Fresh installation password required}@postgres:5432/job_2027'}, setup)
        with self.assertRaises(ValueError):
            producer.validate_placeholders({'value': '${BUILD_HOST_CREDENTIAL}'}, setup)
        with self.assertRaises(ValueError):
            producer.validate_placeholders({'POSTGRES_PASSWORD': '${JOB_POSTGRES_PASSWORD:?Fresh installation password required}'}, {})

    def test_runtime_environment_is_persistent_and_generated_only_in_guest_data(self):
        import subprocess
        config = {'adapter': 'job-2027-upstream', 'runtimeSetup': {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True}}
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.object(runtime_setup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=b'')):
                runtime_setup.setup(config, data)
            environment = data / 'workload/runtime.env'
            original = environment.read_bytes()
            with patch.object(runtime_setup.subprocess, 'run') as command:
                runtime_setup.setup(config, data)
                command.assert_not_called()
            self.assertTrue(environment.read_bytes() == original)

    def test_runtime_environment_preserves_existing_database_volumes(self):
        import subprocess
        config = {'adapter': 'job-2027-upstream', 'runtimeSetup': {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True}}
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            with patch.object(runtime_setup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=b'existing-volume\n')):
                with self.assertRaises(ValueError):
                    runtime_setup.setup(config, data)
            self.assertFalse((data / 'workload/runtime.env').exists())

    def test_shell_payload_rejected(self):
        for field, value in [('name', 'app;id'), ('mode', 'other'), ('persistence', 'false')]:
            spec = self.spec()
            spec[field] = value
            with self.assertRaises(ValueError):
                producer.validate(spec)

    def test_credential_url_rejected(self):
        spec = self.spec()
        spec['kioskUrl'] = 'https://user:password@example.com'
        with self.assertRaises(ValueError):
            producer.validate(spec)

    def test_unknown_version_rejected(self):
        spec = self.spec()
        spec['version'] = 2
        with self.assertRaises(ValueError):
            producer.validate(spec)

    def test_manifest_does_not_invent_iso(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                producer.manifest(Path(temp))
            self.assertFalse((Path(temp) / 'manifest.json').exists())

    def test_runtime_never_formats_data(self):
        script = (ROOT / 'scripts/appliance/runtime.sh').read_text()
        self.assertNotIn('mkfs', script)
        self.assertIn('blkid -L MATERIAL_DATA', script)
        self.assertIn('mountpoint -q /data', script)
        self.assertIn('docker start material-workload', script)


if __name__ == '__main__':
    unittest.main()
