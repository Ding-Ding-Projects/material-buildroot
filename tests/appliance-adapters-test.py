"""Recipe contract checks. These do not build or start workload containers."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'scripts/appliance/adapters/recipes.py'
spec = importlib.util.spec_from_file_location('recipes', MODULE)
recipes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipes)


class AdapterRecipes(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.addCleanup(self.temp.cleanup)

    def files(self, root, entries):
        for name, content in entries.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    def materialize(self, adapter, **kwargs):
        return recipes.materialize(adapter, self.source, self.root / 'recipe',
                                   'a' * 36, 'b' * 40, **kwargs)

    def test_upstream_separates_frontend_api_and_fresh_database(self):
        self.files(self.source, {'backend/pyproject.toml': '', 'backend/src/job_backend/main.py': '',
            'frontend/package.json': '{}', 'frontend/package-lock.json': '{}',
            'frontend/src/app/settings/connection-settings.ts': "local: 'http://127.0.0.1:8000'",
            '.env': 'DO_NOT_COPY', '.hosting/data/private': 'DO_NOT_COPY'})
        result = self.materialize('job-2027-upstream')
        self.assertEqual(set(result['compose']['services']), {'postgres', 'api', 'frontend'})
        self.assertTrue(result['compose']['networks']['backend']['internal'])
        self.assertNotIn('ports', result['compose']['services']['api'])
        self.assertFalse((self.root / 'recipe/source/.env').exists())
        self.assertFalse((self.root / 'recipe/source/.hosting').exists())
        self.assertEqual((self.source / 'frontend/src/app/settings/connection-settings.ts').read_text(),
                         "local: 'http://127.0.0.1:8000'")
        self.assertFalse(result['receipt']['runtimeVerified'])
        self.assertEqual(result['entrypoint'], ['bash', 'build.bat'])
        self.assertIn('return 403', (self.root / 'recipe/nginx.conf').read_text())

    def test_custom_frontend_is_built_and_original_version_is_retained(self):
        frontend = self.root / 'frontend'
        frontend.mkdir()
        pin = 'home-assistant-frontend==20260729.7'
        self.files(self.source, {'pyproject.toml': '', 'requirements.txt': pin,
            'homeassistant/package_constraints.txt': pin,
            'homeassistant/components/frontend/manifest.json': json.dumps({'requirements': [pin]})})
        self.files(frontend, {'pyproject.toml': 'version = "20260729.0"', 'yarn.lock': '',
            'script/build_frontend': '', '.yarn/releases/yarn-4.18.0.cjs': ''})
        result = self.materialize('home-assistant-material', frontend_snapshot=frontend, frontend_revision='c' * 40)
        dockerfile = (self.root / 'recipe/Dockerfile').read_text()
        self.assertIn('sh script/build_frontend', dockerfile)
        self.assertIn('pip check', dockerfile)
        self.assertIn("== '20260729.0'", dockerfile)
        self.assertEqual(result['receipt']['frontendVersion'], '20260729.0')
        self.assertEqual((self.source / 'requirements.txt').read_text(), pin)
        service = result['compose']['services']['homeassistant']
        self.assertEqual(service['network_mode'], 'host')
        self.assertEqual(service['volumes'], ['homeassistant-config:/config'])
        self.assertNotIn('privileged', service)
        self.assertNotIn('devices', service)

    def repository_files(self):
        pin = 'home-assistant-frontend==20261028.5'
        self.files(self.source, {'versions.json': json.dumps({'core': '2026.11.1', 'core_base_image': '2026.10.3'}),
            'core/Dockerfile': '', 'core/pyproject.toml': '', 'core/requirements.txt': 'uv==0.9.0',
            'core/requirements_all.txt': '', 'core/homeassistant/package_constraints.txt': pin,
            'core/homeassistant/components/frontend/manifest.json': json.dumps({'requirements': [pin]}),
            'frontend/package.json': '{}', 'frontend/pnpm-lock.yaml': '', 'frontend/gulpfile.js': '',
            'frontend/pyproject.toml': 'version = "20261028.5"', 'operating-system/Makefile': 'NOT_COPIED',
            'frontend/.env': 'DO_NOT_COPY'})

    def test_one_repository_builds_core_and_frontend_from_the_same_revision(self):
        self.repository_files()
        (self.source / 'core/CLAUDE.md').symlink_to('AGENTS.md')
        result = self.materialize('home-assistant-material', frontend_revision='b' * 40)
        dockerfile = (self.root / 'recipe/Dockerfile').read_text()
        self.assertIn('pnpm install --frozen-lockfile', dockerfile)
        self.assertIn('gulp build-app', dockerfile)
        self.assertIn('amd64-homeassistant-base:2026.10.3', dockerfile)
        self.assertIn('amd64-homeassistant:2026.11.1 AS translations', dockerfile)
        self.assertIn('org.material-buildroot.frontend-revision="' + 'b' * 40 + '"', dockerfile)
        self.assertIn("== '20261028.5'", dockerfile)
        self.assertIn("{print $2}", dockerfile)
        self.assertTrue((self.root / 'recipe/core/requirements.txt').is_file())
        self.assertTrue((self.root / 'recipe/frontend/gulpfile.js').is_file())
        self.assertFalse((self.root / 'recipe/frontend/.env').exists())
        self.assertFalse((self.root / 'recipe/operating-system').exists())
        self.assertFalse((self.root / 'recipe/core/CLAUDE.md').exists())
        receipt = result['receipt']
        self.assertEqual(receipt['frontendRevision'], 'b' * 40)
        self.assertEqual(receipt['frontendVersion'], '20261028.5')
        self.assertIn('core/CLAUDE.md', receipt['snapshotAdjustments'][0]['files'])
        self.assertEqual(result['images'], ['material-buildroot/home-assistant:' + 'a' * 36])
        command = result['buildCommands'][0]
        self.assertIn('--provenance=false', command)
        self.assertIn('type=image,name=material-buildroot/home-assistant:' + 'a' * 36 + ',compression=gzip,force-compression=true', command)
        service = result['compose']['services']['homeassistant']
        self.assertEqual(service['network_mode'], 'host')
        self.assertNotIn('privileged', service)
        self.assertIn('http://127.0.0.1:8123/manifest.json', service['healthcheck']['test'])

    def test_one_repository_requires_readable_versions(self):
        self.repository_files()
        (self.source / 'versions.json').write_text(json.dumps({'core': 'latest', 'core_base_image': '2026.10.3'}))
        with self.assertRaises(ValueError):
            self.materialize('home-assistant-material', frontend_revision='b' * 40)

    def test_renderer_adapter_and_reused_output_are_rejected(self):
        with self.assertRaises(ValueError):
            self.materialize('arbitrary-command')
        (self.root / 'recipe').mkdir()
        with self.assertRaises(ValueError):
            self.materialize('job-2027-upstream')


if __name__ == '__main__':
    unittest.main()
