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

    def test_renderer_adapter_and_reused_output_are_rejected(self):
        with self.assertRaises(ValueError):
            self.materialize('arbitrary-command')
        (self.root / 'recipe').mkdir()
        with self.assertRaises(ValueError):
            self.materialize('job-2027-upstream')


if __name__ == '__main__':
    unittest.main()
