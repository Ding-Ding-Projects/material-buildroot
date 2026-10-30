#!/usr/bin/env python3
"""Validate trusted build plans and stage an offline Buildroot appliance."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
from failure import write_failure
from archive_identity import inspect_archive
from enrollment import derive_enrollment


class SavedImageIdentityMismatch(ValueError):
    pass


class SafeCommandFailure(subprocess.CalledProcessError):
    def __init__(self, error, code):
        super().__init__(error.returncode, [])
        self.code = code


def container_failure(args, error):
    text = (error.stderr or b'').decode('utf-8', errors='replace').lower()
    if any(part in text for part in ('cannot connect to the docker daemon', 'is the docker daemon running', 'permission denied while trying to connect')):
        return 'DOCKER_DAEMON_UNAVAILABLE'
    if any(part in text for part in ('unauthorized', 'authentication required', 'pull access denied', 'requested access to the resource is denied')):
        return 'REGISTRY_AUTH_REQUIRED'
    if any(part in text for part in ('x509:', 'certificate signed by unknown authority', 'certificate has expired', 'tls: failed to verify')):
        return 'REGISTRY_TLS_FAILED'
    if any(part in text for part in ('network is unreachable', 'no such host', 'connection refused', 'i/o timeout', 'context deadline exceeded', 'dial tcp')):
        return 'REGISTRY_NETWORK_FAILED'
    operation = args[1] if len(args) > 1 else ''
    return {'pull': 'DOCKER_PULL_FAILED', 'image': 'DOCKER_INSPECT_FAILED', 'save': 'DOCKER_SAVE_FAILED',
            'load': 'DOCKER_LOAD_FAILED', 'compose': 'DOCKER_COMPOSE_FAILED', 'tag': 'DOCKER_TAG_FAILED'}.get(operation, 'BUILD_STEP_FAILED')


def safe_diagnostic(error):
    if isinstance(error, SavedImageIdentityMismatch):
        return 'SAVED_IMAGE_IDENTITY_MISMATCH', 'python3', 1
    if isinstance(error, SafeCommandFailure):
        return error.code, 'docker', error.returncode
    if isinstance(error, OSError):
        return 'IO_FAILED', 'python3', 1
    if isinstance(error, tarfile.TarError):
        return 'ARCHIVE_FORMAT_UNSUPPORTED', 'python3', 1
    if isinstance(error, (KeyError, TypeError, json.JSONDecodeError)):
        return 'SPEC_INVALID', 'python3', 1
    if isinstance(error, ValueError):
        # Match only our fixed descriptions. Never serialize the description.
        message = str(error).lower()
        if 'compiled guest' in message or 'guest portal source' in message:
            code = 'GUEST_ASSETS_UNAVAILABLE'
        elif 'only docker save archives' in message:
            code = 'ARCHIVE_FORMAT_UNSUPPORTED'
        elif any(part in message for part in ('identity', 'changed during', 'changed while', 'differs from', 'does not belong', 'replace an existing')):
            code = 'SOURCE_IDENTITY_MISMATCH'
        elif 'archive' in message:
            code = 'ARCHIVE_INVALID'
        elif 'prepared' in message:
            code = 'PREPARED_BUNDLE_INVALID'
        elif 'buildroot rejected' in message:
            code = 'CONFIG_INVALID'
        else:
            code = 'SPEC_INVALID'
        return code, 'python3', 1
    return 'PRODUCER_INTERNAL_FAILED', 'producer', 1


def run(*args):
    try:
        return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
    except subprocess.CalledProcessError as error:
        raise SafeCommandFailure(error, container_failure(args, error)) from None


def dump(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n')


def admit_archive(source, destination):
    """Copy a stable input, then inspect Docker metadata without extracting paths."""
    if not source.is_absolute() or source.is_symlink() or not source.is_file():
        raise ValueError('Archive must be an existing regular absolute Linux path')
    with source.open('rb') as original, destination.open('xb') as snapshot:
        before = os.fstat(original.fileno())
        digest = hashlib.sha256()
        while chunk := original.read(1024 * 1024):
            digest.update(chunk)
            snapshot.write(chunk)
        original.seek(0)
        rehashed = hashlib.file_digest(original, 'sha256').hexdigest()
        after = os.fstat(original.fileno())
        if digest.hexdigest() != rehashed or (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError('Archive changed during admission')
    return inspect_archive(destination), digest.hexdigest()


def load_admitted_archive(snapshot, identities, requested, digest):
    if any(reference not in identities for reference in requested):
        raise ValueError('Requested image does not belong to the selected archive')
    # Do not overwrite an unrelated existing tag while loading a multi-image archive.
    for reference, expected in identities.items():
        if reference.startswith('sha256:'):
            continue
        try:
            installed = json.loads(run('docker', 'image', 'inspect', reference))[0]
        except subprocess.CalledProcessError:
            continue
        if not identities.matches(reference, installed['Id']):
            raise ValueError('Archive would replace an existing engine image tag')
    run('docker', 'load', '--input', str(snapshot))
    with snapshot.open('rb') as handle:
        if hashlib.file_digest(handle, 'sha256').hexdigest() != digest:
            raise ValueError('Admitted archive changed while loading')
    for reference in requested:
        installed = json.loads(run('docker', 'image', 'inspect', reference))[0]
        if not identities.matches(reference, installed['Id']):
            raise ValueError('Loaded image identity differs from admitted archive')


def prepared_profile(record):
    adapter = record.get('adapter', 'job-2027-fork')
    profiles = {
        'job-2027-fork': ({'compose.yaml', 'backend/docker/chromium-seccomp.json'}, ('material-buildroot/prepared:', 'postgres:18-bookworm')),
        'job-2027-upstream': ({'compose.yaml', 'source-receipt.json'}, ('material-buildroot/job-api:', 'material-buildroot/job-frontend:', 'postgres:18-bookworm')),
        'home-assistant-material': ({'compose.yaml', 'source-receipt.json'}, ('material-buildroot/home-assistant:',)),
    }
    if adapter not in profiles:
        raise ValueError('Unsupported prepared adapter profile')
    files, prefixes = profiles[adapter]
    inventory = record.get('images')
    if inventory is None and adapter == 'job-2027-fork':
        inventory = [{'reference': record['image'], 'id': record['imageId']}, {'reference': 'postgres:18-bookworm', 'id': record['databaseImageId']}]
    if not isinstance(inventory, list) or len(inventory) != len(prefixes):
        raise ValueError('Prepared image inventory is incomplete')
    identities = {}
    for item in inventory:
        reference, identity = item.get('reference', ''), item.get('id', '')
        if not re.fullmatch('sha256:[a-f0-9]{64}', identity) or reference in identities:
            raise ValueError('Invalid prepared image identity')
        identities[reference] = identity
    if any(sum(reference == prefix if prefix == 'postgres:18-bookworm' else reference.startswith(prefix) and bool(re.fullmatch('[A-Za-z0-9_.-]+', reference[len(prefix):])) for reference in identities) != 1 for prefix in prefixes):
        raise ValueError('Prepared image references differ from the reviewed profile')
    if identities.get(record['image']) != record['imageId']:
        raise ValueError('Prepared primary image identity mismatch')
    if adapter == 'home-assistant-material' and not re.fullmatch('[a-f0-9]{40}', record.get('frontendRevision', '')):
        raise ValueError('Prepared frontend source identity is required')
    setup = record.get('runtimeSetup', {})
    expected_setup = {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True} if adapter == 'job-2027-upstream' else {}
    if setup != expected_setup:
        raise ValueError('Unsupported prepared runtime setup')
    return adapter, files, identities, setup


def validate_placeholders(value, setup):
    allowed = {'${JOB_POSTGRES_PASSWORD:?Fresh installation password required}',
               'postgresql://job_2027:${JOB_POSTGRES_PASSWORD:?Fresh installation password required}@postgres:5432/job_2027'} if setup else set()
    if isinstance(value, str) and ('$' in value) and value not in allowed:
        raise ValueError('Unexpected prepared runtime substitution')
    if isinstance(value, dict):
        for child in value.values():
            validate_placeholders(child, setup)
    elif isinstance(value, list):
        for child in value:
            validate_placeholders(child, setup)


def validate(spec):
    if not isinstance(spec, dict) or spec.get('schemaVersion', spec.get('version', 1)) != 1:
        raise ValueError('Unsupported appliance specification')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,62}', spec.get('name', '')):
        raise ValueError('Invalid appliance name')
    if spec.get('mode') not in ('console', 'kiosk') or type(spec.get('persistence')) is not bool:
        raise ValueError('Invalid appliance mode or persistence flag')
    from urllib.parse import urlsplit
    if spec.get('kioskUrl') or spec['mode'] == 'kiosk':
        url = urlsplit(spec.get('kioskUrl', ''))
        if url.scheme not in ('http', 'https') or url.hostname not in ('localhost', '127.0.0.1', '::1') or url.username or url.password:
            raise ValueError('A credential-free HTTP kiosk URL is required')
    if spec.get('tunnel', {}).get('mode') not in ('off', 'quick', 'named'):
        raise ValueError('Invalid tunnel mode')
    hostname = spec.get('tunnel', {}).get('hostname')
    if hostname and not re.fullmatch(r'(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', hostname):
        raise ValueError('Invalid tunnel hostname')
    source = spec.get('source', {})
    if source.get('kind') not in ('registry', 'archive', 'compose', 'prepared'):
        raise ValueError('Invalid workload source')
    if source['kind'] not in ('compose', 'prepared') and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_./:@-]{0,500}', source.get('image', '')):
        raise ValueError('Invalid container image reference')
    return spec


def prepare(spec_path, output, here):
    spec = validate(json.loads(Path(spec_path).read_text()))
    overlay = output / 'overlay'
    app = overlay / 'opt/material'
    app.mkdir(parents=True)
    guest = here / 'guest'
    if guest.is_dir():
        shutil.copytree(guest, app / 'guest', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        static = next((candidate for candidate in (here.parents[2] / 'appliance-guest', here.parents[1] / 'dist/appliance-guest') if (candidate / 'index.html').is_file()), None)
        if static is None:
            raise ValueError('Compiled guest portal assets are unavailable; build the desktop application first')
        if (app / 'guest/static').exists():
            shutil.rmtree(app / 'guest/static')
        shutil.copytree(static, app / 'guest/static')
    elif spec['mode'] == 'kiosk':
        raise ValueError('The authenticated guest portal source is unavailable')
    source = spec['source']
    compose = None
    admitted = None
    prepared = None
    prepared_identities = {}
    adapter = None
    runtime_setup = {}
    if source['kind'] == 'prepared':
        prepared_path = Path(spec['preparedManifestPath'])
        if not prepared_path.is_absolute() or not prepared_path.is_file() or prepared_path.is_symlink() or prepared_path.stat().st_size > 1024 * 1024:
            raise ValueError('Invalid prepared bundle manifest')
        prepared = json.loads(prepared_path.read_text())
        if prepared.get('schemaVersion') != 1 or prepared.get('completeWorkload') is not True or not re.fullmatch('[a-f0-9]{40}', prepared.get('sourceRevision', '')):
            raise ValueError('Prepared workload bundle is incomplete')
        bundle_root = Path(spec['composePath']).resolve()
        adapter, allowed, prepared_identities, runtime_setup = prepared_profile(prepared)
        files = prepared.get('bundleFiles', [])
        if {item.get('path') for item in files} != allowed or len(files) != len(allowed):
            raise ValueError('Prepared bundle file inventory is incomplete')
        for item in files:
            path = bundle_root / item['path']
            if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(bundle_root) or path.stat().st_size != item['size']:
                raise ValueError('Prepared bundle file identity mismatch')
            with path.open('rb') as handle:
                if hashlib.file_digest(handle, 'sha256').hexdigest() != item['sha256']:
                    raise ValueError('Prepared bundle file hash mismatch')
        for item in files:
            if item['path'] == 'compose.yaml':
                continue
            copied = app / item['path']
            copied.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(bundle_root / item['path'], copied)
            with copied.open('rb') as handle:
                if hashlib.file_digest(handle, 'sha256').hexdigest() != item['sha256']:
                    raise ValueError('Copied bundle file identity mismatch')
            if item['path'] == 'source-receipt.json':
                receipt = json.loads(copied.read_text())
                if receipt.get('adapter') != adapter or receipt.get('sourceRevision') != prepared['sourceRevision'] or (adapter == 'home-assistant-material' and receipt.get('frontendRevision') != prepared.get('frontendRevision')):
                    raise ValueError('Prepared source receipt identity mismatch')
    if source['kind'] in ('archive', 'prepared'):
        archive = Path(spec.get('archivePath', source.get('archivePath', '')))
        admitted = admit_archive(archive, output / 'admitted-images.tar')
        if prepared and (archive.stat().st_size != prepared['archive']['size'] or admitted[1] != prepared['archive']['sha256']):
            raise ValueError('Prepared archive identity mismatch')
    if source['kind'] in ('compose', 'prepared'):
        path = Path(spec.get('composePath', source.get('composePath', '')))
        if path.is_dir():
            path = next((path / name for name in ('compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml') if (path / name).is_file()), path)
        if not path.is_absolute() or not path.is_file():
            raise ValueError('Compose must be an existing absolute Linux path')
        # Reviewed recipe profiles emit JSON, a YAML subset. Do not expand guest
        # installation credentials in the build host's environment.
        if prepared and adapter != 'job-2027-fork':
            compose = json.loads(path.read_text())
            validate_placeholders(compose, runtime_setup)
        else:
            compose = json.loads(run('docker', 'compose', '-f', str(path), 'config', '--format', 'json'))
        if prepared:
            expected_compose = next(item for item in prepared['bundleFiles'] if item['path'] == 'compose.yaml')
            with path.open('rb') as handle:
                if hashlib.file_digest(handle, 'sha256').hexdigest() != expected_compose['sha256']:
                    raise ValueError('Prepared Compose changed during admission')
        if compose.get('secrets') or compose.get('configs'):
            raise ValueError('External Compose secrets/configs must be provisioned on the data disk')
        images = []
        for service in compose.get('services', {}).values():
            if not service.get('image') or service.get('build'):
                raise ValueError('Every Compose service requires a prebuilt image and no build directive')
            if any(service.get(key) for key in ('privileged', 'devices', 'cap_add', 'pid', 'ipc')) or service.get('network_mode') not in (None, 'host'):
                raise ValueError('Privileged or host-namespace Compose services are unsupported')
            for volume in service.get('volumes', []):
                if isinstance(volume, dict):
                    valid = volume.get('type') == 'volume' and bool(volume.get('source'))
                else:
                    valid = isinstance(volume, str) and bool(re.fullmatch(r'[A-Za-z0-9_.-]+:/[A-Za-z0-9_./-]+(?::(?:ro|rw))?', volume))
                if not valid:
                    raise ValueError('Host bind mounts are unsupported; use named persistent volumes')
            if service.get('env_file'):
                raise ValueError('External environment files must be resolved before building')
            if source['kind'] == 'prepared':
                allowed_security = {'no-new-privileges:true', 'seccomp=./backend/docker/chromium-seccomp.json'}
                security = service.get('security_opt', [])
                if any(option not in allowed_security for option in security):
                    raise ValueError('Unexpected prepared workload security profile')
                service['security_opt'] = [option.replace('seccomp=./backend/', 'seccomp=/opt/material/backend/') for option in security]
            service['pull_policy'] = 'never'
            images.append(service['image'])
        if not images:
            raise ValueError('Compose requires at least one service')
        dump(app / 'compose.json', compose)
    else:
        images = [source['image']]
    if admitted:
        if prepared and (set(images) != set(prepared_identities) or any(not admitted[0].matches(reference, identity) for reference, identity in prepared_identities.items())):
            raise ValueError('Prepared Compose or archive images differ from the reviewed inventory')
        if prepared and {reference for reference in admitted[0] if not reference.startswith('sha256:')} != set(prepared_identities):
            raise ValueError('Prepared archive contains unreviewed image references')
        load_admitted_archive(output / 'admitted-images.tar', admitted[0], images, admitted[1])
        if prepared:
            dump(app / 'workload-source.json', {'schemaVersion': 1, 'adapter': adapter, 'sourceRevision': prepared['sourceRevision'],
                 'images': [{'reference': reference, 'id': identity} for reference, identity in prepared_identities.items()],
                 'frontendRevision': prepared.get('frontendRevision'), 'requiresOwnerSetup': True})
    selected_identities = {}
    original_references = {}
    for index, image in enumerate(images):
        if source['kind'] not in ('archive', 'prepared'):
            run('docker', 'pull', '--platform', 'linux/amd64', image)
        metadata = json.loads(run('docker', 'image', 'inspect', image))[0]
        if metadata.get('Os') != 'linux' or metadata.get('Architecture') != 'amd64':
            raise ValueError('The workload must be linux/amd64')
        if prepared and adapter != 'job-2027-fork' and image != 'postgres:18-bookworm':
            labels = metadata.get('Config', {}).get('Labels', {})
            if labels.get('org.opencontainers.image.revision') != prepared['sourceRevision'] or (adapter == 'home-assistant-material' and labels.get('org.material-buildroot.frontend-revision') != prepared.get('frontendRevision')):
                raise ValueError('Loaded prepared image source identity mismatch')
        if source['kind'] == 'registry':
            # Docker save does not reliably retain RepoDigests. Give this exact
            # immutable configuration a guest-local tag before saving offline.
            bundled = 'material-buildroot/appliance:' + metadata['Id'].removeprefix('sha256:')
            try:
                prior = json.loads(run('docker', 'image', 'inspect', bundled))[0]
            except subprocess.CalledProcessError:
                prior = None
            if prior and prior['Id'] != metadata['Id']:
                raise ValueError('Bundled image tag already belongs to another image')
            run('docker', 'tag', metadata['Id'], bundled)
            original_references[bundled] = image
            image = bundled
            images[index] = bundled
        selected_identities[image] = metadata['Id']
    inventory = [json.loads(run('docker', 'image', 'inspect', image))[0] for image in sorted(set(images))]
    run('docker', 'save', '--output', str(app / 'images.tar'), *sorted(set(images)))
    try:
        saved = inspect_archive(app / 'images.tar')
    except (ValueError, KeyError, TypeError, tarfile.TarError):
        raise SavedImageIdentityMismatch('Saved image archive cannot establish a valid content graph') from None
    if any(not saved.matches(reference, identity) for reference, identity in selected_identities.items()):
        raise SavedImageIdentityMismatch('Saved image inventory cannot bind the selected engine identity')
    for reference, original in original_references.items():
        if '@sha256:' in original and saved.content_ids.get(reference):
            if not saved.matches(reference, 'sha256:' + original.rsplit('@sha256:', 1)[1]):
                raise SavedImageIdentityMismatch('Saved OCI graph cannot bind the selected registry descriptor')
    dump(app / 'image-inventory.json', [{'reference': [reference], 'sourceReference': original_references.get(reference, reference),
         'id': saved[reference], 'engineId': item['Id'], 'digests': item.get('RepoDigests', [])} for reference, item in zip(sorted(set(images)), inventory)])
    runtime = {'name': spec['name'], 'mode': spec['mode'], 'persistence': spec['persistence'],
               'kioskUrl': spec.get('kioskUrl', ''), 'tunnel': spec['tunnel'],
               'compose': compose is not None, 'image': images[0], 'wording': bool(spec.get('wordingPath')),
               'guestPortal': guest.is_dir(), 'containerName': None if compose is not None else 'material-workload',
               'adapter': adapter, 'runtimeSetup': runtime_setup}
    enrollment = derive_enrollment(prepared, adapter, compose, saved, runtime['kioskUrl'])
    if enrollment is not None:
        runtime['enrollment'] = enrollment
    dump(app / 'runtime.json', runtime)
    if spec.get('wordingPath'):
        wording = Path(spec['wordingPath'])
        if not wording.is_absolute() or not wording.is_file() or wording.stat().st_size > 1024 * 1024:
            raise ValueError('Personal wording file must be an absolute JSON file smaller than 1 MiB')
        value = json.loads(wording.read_text())
        if not isinstance(value, dict):
            raise ValueError('Personal wording must be a JSON object')
        shutil.copyfile(wording, app / 'personal-vocabulary.json')
        os.chmod(app / 'personal-vocabulary.json', 0o600)
    init = overlay / 'etc/init.d'
    init.mkdir(parents=True)
    shutil.copyfile(here / 'runtime.sh', init / 'S59material-storage')
    shutil.copyfile(here / 'runtime.sh', init / 'S99material-appliance')
    for path in init.iterdir():
        path.chmod(0o755)
    (overlay / 'etc/docker').mkdir(parents=True)
    dump(overlay / 'etc/docker/daemon.json', {'data-root': '/data/docker', 'log-driver': 'local'})
    shutil.copyfile(here / 'kernel.fragment', output / 'kernel.fragment')
    shutil.copyfile(here / 'grub.cfg', output / 'grub.cfg')
    shutil.copyfile(here / 'runtime-setup.py', app / 'runtime-setup.py')
    cache = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home() / '.cache'))) / 'material-buildroot-appliance'
    config = (here / 'base_defconfig').read_text().replace('@OUTPUT@', str(output)).replace('@CACHE@', str(cache))
    if spec['mode'] == 'kiosk':
        config += '\n' + (here / 'kiosk.config').read_text()
    (output / 'appliance_defconfig').write_text(config)


def check_config(output):
    config = (output / 'work/.config').read_text()
    expected = ['BR2_PACKAGE_DOCKER_ENGINE', 'BR2_PACKAGE_DOCKER_CLI', 'BR2_TARGET_ROOTFS_ISO9660', 'BR2_PACKAGE_JQ', 'BR2_PACKAGE_CLOUDFLARED']
    if 'BR2_PACKAGE_COG=y' in (output / 'appliance_defconfig').read_text():
        expected += ['BR2_PACKAGE_COG', 'BR2_PACKAGE_WESTON', 'BR2_PACKAGE_WPEWEBKIT']
    missing = [key for key in expected if key + '=y\n' not in config]
    if missing:
        raise ValueError('Buildroot rejected required configuration: ' + ', '.join(missing))


def manifest(output):
    source = output / 'work/images/rootfs.iso9660'
    if not source.is_file() or source.stat().st_size < 1024 * 1024:
        raise ValueError('Buildroot did not produce a bootable ISO')
    target = output / 'appliance.iso'
    shutil.copyfile(source, target)
    digest = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
    dump(output / 'manifest.json', {'schemaVersion': 1, 'status': 'built',
         'iso': {'path': str(target), 'sha256': digest, 'size': target.stat().st_size},
         'bootVerified': False, 'buildrootVersion': '2025.02.6', 'firmware': 'legacy-bios'})


if __name__ == '__main__':
    failure_output = None
    failure_stage = 'preparing'
    try:
        if sys.argv[1] == '--check-config':
            failure_stage = 'configuring'
            failure_output = Path(sys.argv[3]) if len(sys.argv) > 3 else None
            check_config(Path(sys.argv[2]))
        elif sys.argv[1] == '--manifest':
            failure_stage = 'packaging'
            failure_output = Path(sys.argv[3]) if len(sys.argv) > 3 else None
            manifest(Path(sys.argv[2]))
        elif sys.argv[1] == '--deliver':
            source, destination = Path(sys.argv[2]), Path(sys.argv[3])
            failure_stage, failure_output = 'packaging', destination
            record = json.loads((source / 'manifest.json').read_text())
            shutil.copyfile(source / 'appliance.iso', destination / 'appliance.iso.part')
            (destination / 'appliance.iso.part').replace(destination / 'appliance.iso')
            record['iso']['path'] = str(destination / 'appliance.iso')
            dump(destination / 'manifest.json', record)
        else:
            failure_output = Path(sys.argv[4]) if len(sys.argv) > 4 else None
            prepare(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]))
    except Exception as error:
        code, tool, exit_code = safe_diagnostic(error)
        if failure_output is not None:
            try:
                write_failure(failure_output, failure_stage, code, tool, exit_code)
            except OSError:
                pass
        print('Appliance production failed: ' + code, file=sys.stderr)
        sys.exit(1)
