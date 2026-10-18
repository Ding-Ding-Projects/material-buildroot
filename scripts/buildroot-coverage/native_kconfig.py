"""Inventory the existing admitted parser graph without writing source or build output.

This is planning evidence, not a replacement parser, reconciliation authority or GUI.
"""
import argparse
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import re
import runpy
import subprocess
import sys


def digest(data):
    return hashlib.sha256(data).hexdigest()


def collect(namespace, source, output, adapter):
    """Retain every MenuNode, including hidden and repeated symbol definitions."""
    k, conf = namespace['k'], namespace['conf']
    source, output = Path(source).resolve(), Path(output).resolve()
    roots = [(str(source), '<source>'), (str(output), '<output>')]

    def safe(value):
        if value is None or isinstance(value, (bool, int)):
            return value
        if isinstance(value, (list, tuple)):
            return [safe(item) for item in value]
        if isinstance(value, dict):
            return {key: safe(item) for key, item in value.items()}
        value = str(value)
        for root, label in roots:
            value = value.replace(root, label)
        return re.sub(r'(?:/home/|/Users/|[A-Za-z]:[/\\])[^\s"\']+', '<local-path>', value)

    def location(filename):
        file = Path(filename)
        if not file.is_absolute():
            file = source / file
        file = file.resolve()
        for root, label in [(source, 'source'), (output, 'output')]:
            try:
                return label + '/' + file.relative_to(root).as_posix()
            except ValueError:
                pass
        raise ValueError('Parser referenced a file outside the selected roots')

    nodes, seen = [], {}
    all_nodes = list(conf.node_iter(unique_syms=False))
    ids = {}
    for node in all_nodes:
        item = node.item
        kind = 'symbol' if isinstance(item, k.Symbol) else 'choice' if isinstance(item, k.Choice) else 'menu' if item == k.MENU else 'comment'
        name = item.name if isinstance(item, (k.Symbol, k.Choice)) else None
        base = f'{kind}:{location(node.filename)}:{name or safe(node.prompt[0] if node.prompt else "anonymous")}'
        seen[base] = seen.get(base, 0) + 1
        ids[id(node)] = base if seen[base] == 1 else f'{base}:definition:{seen[base]}'
    expression = lambda value: safe(k.expr_str(value))
    for node in all_nodes:
        item = node.item
        kind = 'symbol' if isinstance(item, k.Symbol) else 'choice' if isinstance(item, k.Choice) else 'menu' if item == k.MENU else 'comment'
        name = item.name if isinstance(item, (k.Symbol, k.Choice)) else None
        protected = bool(name and re.search(r'PASSWD|PASSWORD|TOKEN|SECRET|PRIVATE_KEY', name))
        record = {
            'id': ids[id(node)], 'kind': kind, 'name': name,
            'source': {'path': location(node.filename), 'line': node.linenr},
            'parent': ids.get(id(node.parent)),
            'prompt': safe(node.prompt[0]) if node.prompt else None,
            'promptCondition': expression(node.prompt[1]) if node.prompt else None,
            'help': safe(getattr(node, 'help', None)), 'dependency': expression(node.dep),
            'promptless': node.prompt is None,
            'visible': bool(node.prompt and k.expr_value(node.prompt[1])),
            'defaults': [] if protected else [{'value': expression(value), 'condition': expression(cond)} for value, cond in node.defaults],
            'ranges': [{'min': expression(low), 'max': expression(high), 'condition': expression(cond)} for low, high, cond in node.ranges],
            'selects': [{'symbol': target.name, 'condition': expression(cond)} for target, cond in node.selects],
            'implies': [{'symbol': target.name, 'condition': expression(cond)} for target, cond in node.implies],
            'gui': {'state': 'partial', 'consumer': 'src/renderer/configuration-panel.ts', 'reason': 'Generic controls exist; this definition has no independent interaction acceptance.'},
            'easyMode': {'state': 'missing', 'question': safe(node.prompt[0]) if node.prompt else 'Explain why this internal setting affects the selected project.', 'prefill': 'Use the effective native value; explain a differing requested value before applying changes.', 'control': 'Discover type, choices, ranges and prerequisites before selecting a labeled control.', 'help': 'Explain default, visibility, dependency reasons, architecture limits and interactions; retain source help.'},
            'roadmap': ['PH06-T01', 'PH06-T02', 'PH01-T02-C02'],
            'runtime': 'unverified', 'protectedValues': protected,
        }
        if isinstance(item, (k.Symbol, k.Choice)):
            requested = item.user_value
            if item.orig_type in (k.BOOL, k.TRISTATE) and requested is not None:
                requested = k.TRI_TO_STR[requested]
            record.update(type=k.TYPE_TO_STR[item.orig_type], effectiveType=k.TYPE_TO_STR[item.type],
                          requested=None if protected else safe(requested), effective=None if protected else safe(item.str_value),
                          assignable=[k.TRI_TO_STR[value] for value in item.assignable] if item.type in (k.BOOL, k.TRISTATE) else [])
            if isinstance(item, k.Symbol):
                record.update(reverseDependencyState='unavailable', reverseDependencyReason='Per-definition select/imply edges are retained; aggregate reverse expressions are not formatted because real source exceeds the vendored recursive formatter depth.')
            else:
                record.update(selection=item.selection.name if item.selection else None,
                              requestedSelection=item.user_selection.name if item.user_selection else None)
        nodes.append(record)
    # Independently compare the iterator to the parser's defined-symbol and choice lists.
    symbol_nodes = sum(len(symbol.nodes) for symbol in conf.unique_defined_syms)
    choice_nodes = sum(len(choice.nodes) for choice in conf.unique_choices)
    if sum(node['kind'] == 'symbol' for node in nodes) != symbol_nodes or sum(node['kind'] == 'choice' for node in nodes) != choice_nodes:
        raise ValueError('Parser node enumeration disagrees with definition lists')
    files = []
    virtual = namespace.get('virtual', {})
    for filename in sorted(set(conf.kconfig_filenames)):
        full = Path(filename) if Path(filename).is_absolute() else source / filename
        normalized = os.path.normcase(os.path.abspath(full))
        data = virtual[normalized].encode() if normalized in virtual else full.read_bytes()
        files.append({'path': location(full), 'sha256': digest(data), 'bytes': len(data), 'virtual': normalized in virtual})
    adapter = Path(adapter)
    makefile = (source / 'Makefile').read_bytes()
    version = re.search(rb'^export BR2_VERSION\s*:?=\s*(\S+)', makefile, re.M)
    return {'schemaVersion': 1,
            'binding': {'version': version.group(1).decode() if version else 'fixture', 'makefileSha256': digest(makefile),
                        'configurationSha256': digest((output / '.config').read_bytes()) if (output / '.config').exists() else None,
                        'files': files, 'parserSha256': digest((adapter / 'vendor/kconfiglib.py').read_bytes()),
                        'adapterSha256': digest((adapter / 'inspect.py').read_bytes()), 'inventorySha256': digest(Path(__file__).read_bytes())},
            'enumeration': {'nodes': len(nodes), 'uniqueSymbols': len(conf.unique_defined_syms), 'uniqueChoices': len(conf.unique_choices),
                            'symbolDefinitions': symbol_nodes, 'choiceDefinitions': choice_nodes,
                            'hiddenNodes': sum(not node['visible'] for node in nodes), 'promptlessNodes': sum(node['promptless'] for node in nodes)},
            'scope': {'state': 'partial', 'meaning': 'Complete MenuNode enumeration for this parser invocation, not all versions, configurations, external trees or native conf semantic parity.',
                      'limitations': ['No external trees selected.', 'Source-provided Kconfig commands may execute only for the explicitly trusted non-root Linux source.',
                                      'Existing parser synthesizes external include files; their virtual bytes are hashed separately.',
                                      'Protected values and local paths are withheld; source help is not independent contextual documentation acceptance.',
                                      'Native conf reconciliation, GUI controls and Easy-mode interaction remain unverified.']}, 'nodes': nodes}


def validate(actual, expected):
    for kind in ('symbol', 'choice', 'menu', 'comment'):
        if any(node['kind'] == kind for node in expected['nodes']) and not any(node['kind'] == kind for node in actual['nodes']):
            raise ValueError('Missing node category: ' + kind)
    actual_ids = [node['id'] for node in actual['nodes']]
    if len(set(actual_ids)) != len(actual_ids):
        raise ValueError('Duplicate node identity')
    if set(actual_ids) != {node['id'] for node in expected['nodes']}:
        raise ValueError('Missing or unexpected source node')
    if actual != expected:
        raise ValueError('Changed source binding, semantics or disposition')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--build-output', required=True)
    parser.add_argument('--adapter', required=True)
    parser.add_argument('--destination', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if sys.platform != 'linux' or os.geteuid() == 0:
        raise PermissionError('Use the selected non-root Linux source host')
    source, output, adapter = map(lambda value: str(Path(value).resolve()), (args.source, args.build_output, args.adapter))
    destination = Path(args.destination).resolve()
    # The only writes are inventory shards under the explicit destination.
    if destination == Path(source) or Path(source) in destination.parents or destination == Path(output) or Path(output) in destination.parents:
        raise ValueError('Inventory destination must be outside source and build output')
    version = re.search(r'^export BR2_VERSION\s*:?=\s*(\S+)', (Path(source) / 'Makefile').read_text(), re.M).group(1)
    environment = {'BASE_DIR': output, 'BR2_BASE_DIR': output, 'TOPDIR': source, 'CONFIG_DIR': output, 'BR2_CONFIG': output+'/.config',
                   'BR2_DEFCONFIG': output+'/defconfig', 'SKIP_LEGACY': '', 'BR2_VERSION_FULL': version, 'HOSTARCH': platform.machine(),
                   'HOST_GCC_VERSION': subprocess.check_output(['gcc', '-dumpversion'], text=True).strip(), 'PATH': '/usr/bin:/bin'}
    request = {'sourceRoot': source, 'outputRoot': output, 'buildroot': True, 'environment': environment,
               'evaluationMode': 'trusted-linux-runtime-v1', 'binding': {'admissionId': 'source-coverage-read-only', 'sourceRevision': digest((Path(source)/'Makefile').read_bytes()), 'configRevision': digest((Path(output)/'.config').read_bytes())},
               'externalRoots': [], 'externalTrees': []}
    initial_files = {str(file.resolve()): digest(file.read_bytes()) for file in Path(source).rglob('Config.in*') if file.is_file()}
    initial_files[str(Path(source)/'Makefile')] = digest((Path(source)/'Makefile').read_bytes())
    previous_stdin = sys.stdin
    sys.stdin = io.StringIO(json.dumps(request))
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            namespace = runpy.run_path(str(Path(adapter)/'inspect.py'))
    finally:
        sys.stdin = previous_stdin
    result = collect(namespace, source, output, adapter)
    if result['binding']['configurationSha256'] != request['binding']['configRevision'] or any(digest(Path(file).read_bytes()) != before for file, before in initial_files.items()):
        raise ValueError('Source or existing output configuration changed during inspection')
    result['binding']['environment'] = {key: value for key, value in environment.items() if key in ('BR2_VERSION_FULL', 'HOSTARCH', 'HOST_GCC_VERSION', 'SKIP_LEGACY')}
    result['binding']['existingConfigurationUnchanged'] = True
    proof = []
    for kind in ('symbol', 'choice', 'menu', 'comment', 'hidden'):
        selected = next((node for node in result['nodes'] if (not node['visible'] if kind == 'hidden' else node['kind'] == kind)), None)
        if selected is None:
            raise ValueError('Required real-source proof category unavailable: ' + kind)
        missing = dict(result, nodes=[node for node in result['nodes'] if node['id'] != selected['id']])
        try:
            validate(missing, result)
        except ValueError:
            proof.append({'omitted': kind, 'id': selected['id'], 'state': 'rejected'})
        else:
            raise ValueError('Omission was accepted: ' + kind)
    validate(result, result)
    result['completenessProof'] = {'restored': 'passed', 'omissions': proof, 'scope': 'One actual node from each handwritten category plus one hidden node; fixture tests additionally remove every fixture node and semantic field.'}
    shards = []
    for offset in range(0, len(result['nodes']), 200):
        name = 'nodes-%03d.json' % (offset // 200)
        data = (json.dumps(result['nodes'][offset:offset+200], ensure_ascii=False, indent=2)+'\n').encode()
        shards.append({'path': name, 'sha256': digest(data), 'nodes': len(result['nodes'][offset:offset+200])})
        if not args.check:
            destination.mkdir(parents=True, exist_ok=True)
            (destination/name).write_bytes(data)
    index = {key: value for key, value in result.items() if key != 'nodes'}
    index['shards'] = shards
    if args.check:
        stored = json.loads((destination/'index.json').read_text())
        actual = {key: value for key, value in stored.items() if key != 'shards'}
        actual['nodes'] = []
        for shard in stored['shards']:
            if not re.fullmatch(r'nodes-\d{3}\.json', shard['path']):
                raise ValueError('Unsafe shard path')
            data = (destination/shard['path']).read_bytes()
            if digest(data) != shard['sha256']:
                raise ValueError('Changed shard hash')
            actual['nodes'].extend(json.loads(data))
        validate(actual, result)
        if stored != index:
            raise ValueError('Changed shard inventory')
    else:
        (destination/'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result['enumeration'], sort_keys=True))


if __name__ == '__main__':
    main()
