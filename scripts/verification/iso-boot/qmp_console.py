#!/usr/bin/env python3
"""Non-root Linux QEMU VGA acceptance helper. Receipts are private until reviewed."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import time
from datetime import datetime, timezone


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stamp():
    return datetime.now(timezone.utc).isoformat()


def identity(pid):
    return Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]


class Qmp:
    def __init__(self, path):
        self.socket = socket.socket(socket.AF_UNIX)
        self.socket.settimeout(10)
        self.socket.connect(str(path))
        self.stream = self.socket.makefile('rwb', buffering=0)
        assert 'QMP' in json.loads(self.stream.readline())
        self.call('qmp_capabilities')

    def call(self, command, arguments=None):
        request = {'execute': command}
        if arguments is not None:
            request['arguments'] = arguments
        self.stream.write((json.dumps(request) + '\n').encode())
        while True:
            reply = json.loads(self.stream.readline())
            if 'error' in reply:
                raise RuntimeError(reply['error'])
            if 'return' in reply:
                return reply['return']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session', required=True, type=Path)
    commands = parser.add_subparsers(dest='command', required=True)
    start = commands.add_parser('start')
    start.add_argument('--iso', required=True, type=Path)
    start.add_argument('--sha256', required=True)
    start.add_argument('--build-receipt', required=True, type=Path)
    start.add_argument('--qemu', default='/usr/bin/qemu-system-x86_64')
    start.add_argument('--single-step', action='store_true', help='Diagnostic single-instruction translation blocks')
    start.add_argument('--vga', choices=['std', 'cirrus'], default='cirrus')
    start.add_argument('--cpu', choices=['qemu64', 'max'], default='qemu64')
    start.add_argument('--nic', choices=['virtio-net-pci', 'rtl8139', 'e1000'], default='rtl8139')
    capture = commands.add_parser('capture')
    capture.add_argument('name')
    key = commands.add_parser('key')
    key.add_argument('qcodes', nargs='+')
    text = commands.add_parser('text')
    text.add_argument('value')
    commands.add_parser('status')
    commands.add_parser('powerdown')
    commands.add_parser('verify-exit')
    args = parser.parse_args()
    if os.getuid() == 0:
        raise SystemExit('Run as a non-root user.')
    folder = args.session.resolve()
    if args.command == 'start':
        receipt = json.loads(args.build_receipt.read_text())
        iso = args.iso.resolve(strict=True)
        if ',' in str(iso) or '\n' in str(iso):
            raise SystemExit('ISO paths must not contain QEMU option separators.')
        if receipt.get('exitCode') != 0 or receipt.get('isoSha256') != args.sha256:
            raise SystemExit('A successful full-build receipt with matching ISO hash is required.')
        if not re.fullmatch('[0-9a-f]{64}', args.sha256) or digest(iso) != args.sha256:
            raise SystemExit('ISO hash mismatch.')
        folder.mkdir(mode=0o700, parents=True, exist_ok=False)
        sock = folder / 'qmp.sock'
        if len(str(sock).encode()) >= 104:
            raise SystemExit('Use a shorter session directory for the Unix socket.')
        command = [args.qemu, '-machine', 'pc', '-accel', 'tcg,thread=single', '-m', '512',
                   '-smp', '1', '-cpu', args.cpu, '-boot', 'd', '-drive', f'file={iso},media=cdrom,readonly=on',
                   '-display', 'none', '-vga', args.vga, '-serial', 'none', '-monitor', 'none',
                   '-nic', f'user,model={args.nic}', '-qmp', f'unix:{sock},server=on,wait=off',
                   '-pidfile', str(folder / 'qemu.pid')]
        if args.single_step:
            command.append('-singlestep')
        log = open(folder / 'qemu.log', 'xb')
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=log)
        pid = process.pid
        for _ in range(100):
            if sock.exists():
                break
            if process.poll() is not None:
                raise SystemExit('QEMU exited before its monitor was ready; inspect the private log.')
            time.sleep(0.1)
        else:
            process.terminate()
            process.wait(timeout=10)
            raise SystemExit('QEMU monitor startup timed out.')
        record = {'createdAt': stamp(), 'pid': pid, 'processStart': identity(pid),
                  'processCommandSha256': digest(f'/proc/{pid}/cmdline'),
                  'isoSha256': args.sha256, 'isoSize': iso.stat().st_size,
                  'buildReceiptSha256': digest(args.build_receipt), 'command': command,
                  'qemuVersion': subprocess.check_output([args.qemu, '--version'], text=True).splitlines()[0],
                  'qemuSha256': digest(args.qemu), 'route': 'linux-qemu-qmp-vga',
                  'defaultBootArgumentsUnmodified': True}
        (folder / 'session.json').write_text(json.dumps(record, indent=2))
        print(json.dumps({'started': True, 'pid': pid, 'isoSha256': args.sha256}), flush=True)
        code = process.wait()
        terminal = {'exitedAt': stamp(), 'exitCode': code}
        (folder / 'terminal.json').write_text(json.dumps(terminal, indent=2))
        print(json.dumps(terminal), flush=True)
        log.close()
        raise SystemExit(0 if code == 0 else 1)
    record = json.loads((folder / 'session.json').read_text())
    pid = record['pid']
    if args.command == 'verify-exit':
        exists = Path(f'/proc/{pid}').exists()
        owned = exists and identity(pid) == record['processStart']
        result = {'checkedAt': stamp(), 'ownedProcessAbsent': not owned}
        (folder / 'exit.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        raise SystemExit(1 if owned else 0)
    if not Path(f'/proc/{pid}').exists():
        raise SystemExit('Owned QEMU process has exited; inspect its terminal receipt and log.')
    if identity(pid) != record['processStart']:
        raise SystemExit('Process identity changed.')
    if digest(f'/proc/{pid}/cmdline') != record['processCommandSha256']:
        raise SystemExit('Process command changed.')
    qmp = Qmp(folder / 'qmp.sock')
    if args.command == 'capture':
        if not re.fullmatch('[a-z0-9-]+', args.name):
            raise SystemExit('Capture names use lowercase letters, digits and hyphens.')
        output = folder / (args.name + '.ppm')
        if output.exists():
            raise SystemExit('Capture already exists.')
        qmp.call('screendump', {'filename': str(output)})
        result = {'capturedAt': stamp(), 'file': output.name, 'sha256': digest(output),
                  'source': 'QMP screendump', 'isoSha256': record['isoSha256']}
        (folder / (args.name + '.json')).write_text(json.dumps(result, indent=2))
    elif args.command == 'key':
        result = qmp.call('send-key', {'keys': [{'type': 'qcode', 'data': key} for key in args.qcodes], 'hold-time': 60})
    elif args.command == 'text':
        mapping = {' ': 'spc', '\n': 'ret', '-': 'minus', '/': 'slash', '.': 'dot', '=': 'equal', ';': 'semicolon'}
        if not all(c in mapping or c in 'abcdefghijklmnopqrstuvwxyz0123456789' for c in args.value):
            raise SystemExit('Unsupported text character; use explicit QMP key codes.')
        for char in args.value:
            qmp.call('send-key', {'keys': [{'type': 'qcode', 'data': mapping.get(char, char)}], 'hold-time': 30})
            time.sleep(0.06)
        result = {'charactersSent': len(args.value)}
    elif args.command == 'powerdown':
        result = qmp.call('system_powerdown')
    else:
        result = qmp.call('query-status')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
