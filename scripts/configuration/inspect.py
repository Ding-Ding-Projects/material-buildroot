"""Read-only Kconfig bridge. Input is supplied by the admitted host adapter."""
import sys, os, json, io, contextlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))
import kconfiglib as k
request = json.load(sys.stdin)
trusted_runtime = request.get('evaluationMode') == 'trusted-linux-runtime-v1'
if trusted_runtime:
    if sys.platform != 'linux' or not hasattr(os, 'geteuid') or os.geteuid() == 0:
        raise PermissionError('Trusted Kconfig evaluation requires a non-root Linux runtime')
    binding = request.get('binding', {})
    if not all(isinstance(binding.get(key), str) and binding[key] for key in
               ('admissionId', 'sourceRevision', 'configRevision')):
        raise PermissionError('Missing source-specific Kconfig admission')
    # Load standard subprocess machinery before installing the read-only audit
    # hook. Source commands are allowed only in the separately admitted runtime.
    import subprocess
source = os.path.realpath(request['sourceRoot'])
output = os.path.realpath(request['outputRoot'])
allowed = [source, output] + request.get('externalRoots', [])
def inside(filename):
    real = os.path.realpath(filename)
    for root in allowed:
        try:
            if os.path.normcase(os.path.commonpath([real, root])) == os.path.normcase(root):
                return True
        except ValueError:
            pass
    return False
# Restrict file reads, including Kconfig source statements, to admitted trees and
# the vendored module. Python audit hooks run before the underlying open.
def audit(event, args):
    if trusted_runtime:
        # This is execution of explicitly trusted source, not a Python sandbox.
        # Runtime isolation, process ownership and cancellation belong to the host.
        return
    if event in ('subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn', 'exec'):
        raise PermissionError('Kconfig command evaluation requires a separate admitted adapter')
    if event == 'open' and isinstance(args[0], (str, bytes)):
        filename = os.fsdecode(args[0])
        mode = args[1]
        if isinstance(mode, str) and any(c in mode for c in 'wax+'):
            raise PermissionError('Read-only Kconfig bridge')
        if not inside(filename):
            raise PermissionError('Kconfig source outside admitted roots')
sys.addaudithook(audit)
os.chdir(source)
os.environ.clear()
os.environ.update(request.get('environment', {}))
# Do not import source-provided Python extensions as a side effect of parsing.
os.environ['KCONFIG_FUNCTIONS'] = '_material_buildroot_no_source_python_plugins_'
os.environ['srctree'] = request.get('sourceReference', source)
os.environ['objtree'] = request.get('outputReference', output)
os.environ['CONFIG_'] = request.get('prefix', '')
virtual = {}
if request.get('buildroot'):
    for category in ('paths', 'menus', 'toolchains', 'jpeg', 'openssl', 'skeleton', 'init', 'linux'):
        virtual[os.path.join(output, '.br2-external.in.' + category)] = ''
    trees = request.get('externalTrees', [])
    paths = ['config BR2_EXTERNAL_NAMES', '\tstring', '\tdefault "' + ' '.join(tree['name'] for tree in trees) + '"', ''] if trees else []
    menus = ['menu "External options"', ''] if trees else []
    for tree in trees:
        name, root, description = tree['name'], tree['root'], tree['description']
        reference = tree['kconfigRoot']
        paths += ['config BR2_EXTERNAL_' + name + '_PATH', '\tstring', '\tdefault "' + reference + '"', '']
        menus += ['menu "' + description + '"', 'source "' + reference + '/Config.in"', 'endmenu', '']
        for category in ('toolchains', 'jpeg', 'openssl', 'skeleton', 'init', 'linux'):
            relative = 'linux/Config.ext.in' if category == 'linux' else 'provides/' + category + '.in'
            filename = os.path.join(root, relative)
            if os.path.isfile(filename):
                virtual[os.path.join(output, '.br2-external.in.' + category)] += 'source "' + reference + '/' + relative + '"\n'
    if trees:
        menus.append('endmenu')
    virtual[os.path.join(output, '.br2-external.in.paths')] = '\n'.join(paths)
    virtual[os.path.join(output, '.br2-external.in.menus')] = '\n'.join(menus)
virtual = {os.path.normcase(os.path.abspath(filename)): content for filename, content in virtual.items()}
original_glob = k.iglob
def virtual_glob(pattern):
    canonical = os.path.normcase(os.path.abspath(pattern))
    return iter([canonical]) if canonical in virtual else original_glob(pattern)
k.iglob = virtual_glob
class ReadOnlyKconfig(k.Kconfig):
    def _open(self, filename, mode):
        canonical = os.path.normcase(os.path.abspath(filename))
        if mode == 'r' and canonical in virtual:
            return io.StringIO(virtual[canonical])
        return super()._open(filename, mode)
# Kconfig's info function prints to stdout. Keep the protocol stream exclusively
# JSON while retaining bounded diagnostics separately.
diagnostics = io.StringIO()
with contextlib.redirect_stdout(diagnostics):
    conf = ReadOnlyKconfig(request.get('entrypoint', 'Config.in'), warn_to_stderr=False, suppress_traceback=True)
config = os.path.join(output, '.config')
if os.path.isfile(config):
    conf.load_config(config)
count = 0
def expression(value):
    return k.expr_str(value)[:16384]
def node_json(node, depth=0):
    global count
    count += 1
    if count > 100000 or depth > 128:
        raise ValueError('Kconfig tree limit exceeded')
    item = node.item
    result = {'kind': 'menu' if item == k.MENU else 'comment' if item == k.COMMENT else 'choice' if isinstance(item, k.Choice) else 'symbol', 'prompt': node.prompt[0] if node.prompt else None, 'help': (getattr(node, 'help', '') or '')[:65536], 'dependency': expression(node.dep), 'visibility': k.expr_value(node.prompt[1]) if node.prompt else 0}
    if isinstance(item, (k.Symbol, k.Choice)):
        result.update({'name': item.name, 'type': k.TYPE_TO_STR[item.type], 'value': item.str_value, 'assignable': list(item.assignable) if item.type in (k.BOOL, k.TRISTATE) else []})
        if isinstance(item, k.Symbol):
            result['symbol'] = os.environ['CONFIG_'] + item.name
            result['ranges'] = [{'min': lo.str_value, 'max': hi.str_value, 'condition': expression(cond), 'active': bool(k.expr_value(cond))} for lo, hi, cond in item.ranges]
            result['defaults'] = [{'value': expression(value), 'condition': expression(cond)} for value, cond in item.defaults]
        else:
            result['selection'] = item.selection.name if item.selection else None
    children = []
    child = node.list
    while child:
        children.append(node_json(child, depth + 1)); child = child.next
    result['children'] = children
    return result
result = {'available': True, 'adapter': 'kconfiglib', 'version': '14.1.0', 'evaluationMode': 'trusted-linux-runtime-v1' if trusted_runtime else 'read-only-host', 'binding': request.get('binding') if trusted_runtime else None, 'reconciliationAuthority': 'source-native-conf-required', 'externalTrees': [{'name': tree['name'], 'description': tree['description']} for tree in request.get('externalTrees', [])], 'tree': node_json(conf.top_node), 'warnings': conf.warnings[:1000], 'diagnostics': diagnostics.getvalue()[:8192]}
encoded = json.dumps(result)
if len(encoded) > 16 * 1024 * 1024:
    raise ValueError('Kconfig JSON limit exceeded')
sys.stdout.write(encoded)
