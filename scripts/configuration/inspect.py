"""Read-only Kconfig bridge. Input is supplied by the admitted host adapter."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))
import kconfiglib as k
request = json.load(sys.stdin)
source = os.path.realpath(request['sourceRoot'])
output = os.path.realpath(request['outputRoot'])
allowed = [source, output] + request.get('externalRoots', [])
def inside(filename):
    real = os.path.realpath(filename)
    return any(os.path.commonpath([real, root]) == root for root in allowed)
# Restrict file reads, including Kconfig source statements, to admitted trees and
# the vendored module. Python audit hooks run before the underlying open.
def audit(event, args):
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
os.environ['srctree'] = source
os.environ['objtree'] = output
os.environ['CONFIG_'] = request.get('prefix', '')
conf = k.Kconfig(request.get('entrypoint', 'Config.in'), warn_to_stderr=False, suppress_traceback=True)
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
result = {'available': True, 'adapter': 'kconfiglib', 'version': '14.1.0', 'tree': node_json(conf.top_node), 'warnings': conf.warnings[:1000]}
encoded = json.dumps(result)
if len(encoded) > 16 * 1024 * 1024:
    raise ValueError('Kconfig JSON limit exceeded')
sys.stdout.write(encoded)
