"""Negative completeness tests for the source inventory, never a Buildroot build."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
sys.path.insert(0, str(APP/'scripts/configuration/vendor'))
import kconfiglib as k
from native_kconfig import collect, validate


class NativeInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='buildroot-native-inventory-')
        self.root = Path(self.temporary.name)
        self.source = self.root/'source'
        self.output = self.root/'output'
        self.source.mkdir()
        self.output.mkdir()
        (self.source/'Makefile').write_text('export BR2_VERSION := 2025.02\n')
        (self.source/'Config.in').write_text('''mainmenu "Fixture"
menu "Visible menu"
config ENABLE
 bool "Enable"
 default y
config HIDDEN
 bool
 default y
config VALUE
 int "Number"
 range 1 9
 default 3
 help
   A bounded number.
config SELECTOR
 bool "Selector"
 select HIDDEN
 imply ENABLE
choice PROFILE
 prompt "Profile"
 default PROFILE_A
config PROFILE_A
 bool "A"
config PROFILE_B
 bool "B"
endchoice
comment "A comment"
config TEST_SECRET
 string "Protected fixture field"
 default "PUBLIC_FIXTURE_DEFAULT"
endmenu
config ENABLE
 bool
''')
        (self.output/'.config').write_text('CONFIG_ENABLE=y\nCONFIG_VALUE=7\nCONFIG_TEST_SECRET="PUBLIC_FIXTURE_SENTINEL"\n')
        self.conf = k.Kconfig(str(self.source/'Config.in'), warn=False)
        self.conf.load_config(str(self.output/'.config'))
        self.data = collect({'k': k, 'conf': self.conf}, self.source, self.output, APP/'scripts/configuration')

    def tearDown(self):
        self.temporary.cleanup()

    def test_complete_hidden_repeat_and_semantics(self):
        validate(self.data, self.data)
        self.assertEqual(len(self.data['nodes']), len(list(self.conf.node_iter())))
        self.assertEqual(len([n for n in self.data['nodes'] if n['name'] == 'ENABLE']), 2)
        hidden = next(n for n in self.data['nodes'] if n['name'] == 'HIDDEN')
        self.assertTrue(hidden['promptless'])
        self.assertFalse(hidden['visible'])
        number = next(n for n in self.data['nodes'] if n['name'] == 'VALUE')
        self.assertEqual(number['requested'], '7')
        self.assertEqual(number['effective'], '7')
        self.assertEqual(number['ranges'][0]['min'], '1')
        self.assertEqual(number['defaults'][0]['value'], '3')
        self.assertIn('bounded', number['help'])
        selector = next(n for n in self.data['nodes'] if n['name'] == 'SELECTOR')
        self.assertEqual(selector['selects'][0]['symbol'], 'HIDDEN')
        self.assertEqual(selector['implies'][0]['symbol'], 'ENABLE')
        self.assertTrue(all(n['source']['line'] > 0 for n in self.data['nodes']))

    def test_every_node_and_handwritten_category_omission_is_red(self):
        for node in self.data['nodes']:
            missing = copy.deepcopy(self.data)
            missing['nodes'] = [n for n in missing['nodes'] if n['id'] != node['id']]
            with self.assertRaisesRegex(ValueError, 'Missing'):
                validate(missing, self.data)
        for kind in ('symbol', 'choice', 'menu', 'comment'):
            missing = copy.deepcopy(self.data)
            missing['nodes'] = [n for n in missing['nodes'] if n['kind'] != kind]
            with self.assertRaisesRegex(ValueError, 'Missing node category'):
                validate(missing, self.data)
        validate(self.data, self.data)

    def test_semantic_omission_and_false_gui_acceptance_are_red(self):
        for key in ('prompt', 'help', 'dependency', 'defaults', 'ranges', 'selects', 'implies', 'source'):
            missing = copy.deepcopy(self.data)
            del missing['nodes'][0][key]
            with self.assertRaisesRegex(ValueError, 'semantics'):
                validate(missing, self.data)
        optimistic = copy.deepcopy(self.data)
        optimistic['nodes'][0]['gui']['state'] = 'supported'
        with self.assertRaisesRegex(ValueError, 'disposition'):
            validate(optimistic, self.data)

    def test_private_paths_and_protected_values_are_not_published(self):
        serialized = json.dumps(self.data)
        self.assertNotIn(str(self.source), serialized)
        self.assertNotIn(str(self.output), serialized)
        self.assertNotIn('PUBLIC_FIXTURE_SENTINEL', serialized)
        self.assertNotIn('PUBLIC_FIXTURE_DEFAULT', serialized)
        protected = next(n for n in self.data['nodes'] if n['name'] == 'TEST_SECRET')
        self.assertIsNone(protected['requested'])
        self.assertIsNone(protected['effective'])


if __name__ == '__main__':
    unittest.main()
