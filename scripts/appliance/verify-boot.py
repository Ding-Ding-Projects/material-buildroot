#!/usr/bin/env python3
"""Bounded, non-root boot verification of the exact produced Linux ISO."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from importlib.util import spec_from_file_location, module_from_spec


def qmp_capture(path, destination):
    with socket.socket(socket.AF_UNIX) as connection:
        connection.settimeout(5)
        connection.connect(str(path))
        stream = connection.makefile('rwb')
        stream.readline()
        for command in ({'execute': 'qmp_capabilities', 'id': 'cap'},
                        {'execute': 'screendump', 'arguments': {'filename': str(destination)}, 'id': 'screen'}):
            stream.write((json.dumps(command) + '\r\n').encode())
            stream.flush()
            while True:
                reply = json.loads(stream.readline())
                if reply.get('id') == command['id']:
                    if 'error' in reply:
                        raise ValueError('QMP screenshot failed')
                    break


def verify(iso, expected, output):
    if os.getuid() == 0:
        raise ValueError('Boot verification must run as an unprivileged user')
    if not re.fullmatch('[a-f0-9]{64}', expected) or not iso.is_absolute() or not iso.is_file() or iso.is_symlink():
        raise ValueError('Invalid ISO identity')
    with iso.open('rb') as handle:
        actual = hashlib.file_digest(handle, 'sha256').hexdigest()
    if actual != expected:
        raise ValueError('ISO hash mismatch')
    if output.exists():
        raise ValueError('Select a new verification directory')
    for tool in ('qemu-system-x86_64', 'mkfs.ext4'):
        if not shutil.which(tool):
            raise ValueError('Boot verification dependency unavailable: ' + tool)
    iso_mib = (iso.stat().st_size + 1024 ** 2 - 1) // 1024 ** 2
    memory_mib = max(4096, iso_mib * 2 + 3072)
    available = next(int(line.split()[1]) // 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    if memory_mib > 32768 or available < memory_mib + 1024:
        raise ValueError('Insufficient available memory for this ISO verification')
    output.mkdir(parents=True, mode=0o700)
    data = output / 'data.ext4'
    with data.open('xb') as handle:
        handle.truncate(max(16 * 1024 ** 3, iso.stat().st_size * 4))
    subprocess.run(['mkfs.ext4', '-q', '-F', '-L', 'MATERIAL_DATA', str(data)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    serial = output / 'serial.log'
    record = {'schemaVersion': 1, 'isoSha256': actual, 'bootVerified': False, 'kernelBooted': False,
              'runtimeReady': False, 'workloadStarted': False, 'workloadReady': False, 'method': 'qemu-serial',
              'limitations': ['Physical hardware, UEFI, LAN access, kiosk interaction, persistence across reboot and tunnel enrollment are not verified.']}
    # Keep the Unix socket short even when the selected output path is long.
    with tempfile.TemporaryDirectory(prefix='material-qmp-') as control:
        monitor = Path(control) / 'qmp.sock'
        args = ['qemu-system-x86_64', '-machine', 'q35', '-accel', 'tcg', '-m', str(memory_mib), '-smp', '2',
                '-boot', 'd', '-cdrom', str(iso), '-display', 'none', '-vga', 'std',
                '-serial', 'file:' + str(serial), '-qmp', 'unix:' + str(monitor) + ',server=on,wait=off',
                '-blockdev', json.dumps({'driver': 'file', 'filename': str(data), 'node-name': 'datafile'}),
                '-blockdev', json.dumps({'driver': 'raw', 'file': 'datafile', 'node-name': 'datadisk'}),
                '-device', 'virtio-blk-pci,drive=datadisk', '-nic', 'user,model=virtio-net-pci', '-no-reboot']
        with (output / 'qemu.log').open('wb') as log:
            process = subprocess.Popen(args, stdout=log, stderr=log, start_new_session=True)
            module_spec = spec_from_file_location('appliance_control', Path(__file__).with_name('control-appliance.py'))
            controller = module_from_spec(module_spec)
            module_spec.loader.exec_module(controller)
            (output / 'process.json').write_text(json.dumps(controller.identity(process.pid)))
            (output / 'process.json').chmod(0o600)
            def terminate(_signal=None, _frame=None):
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
            signal.signal(signal.SIGTERM, terminate)
            signal.signal(signal.SIGINT, terminate)
            try:
                deadline = time.monotonic() + 600
                print('APPLIANCE_PHASE:booting', flush=True)
                while time.monotonic() < deadline and process.poll() is None:
                    text = serial.read_text(errors='replace') if serial.exists() else ''
                    record['kernelBooted'] = 'Linux version ' in text
                    record['runtimeReady'] = 'Run /sbin/init as init process' in text or 'Starting syslogd' in text
                    record['workloadStarted'] = 'MATERIAL_APPLIANCE_WORKLOAD_STARTED' in text
                    record['workloadReady'] = 'MATERIAL_APPLIANCE_WORKLOAD_HEALTHY' in text
                    if all(record[key] for key in ('kernelBooted', 'runtimeReady', 'workloadReady')):
                        qmp_capture(monitor, output / 'screen.ppm')
                        record['bootVerified'] = True
                        break
                    time.sleep(1)
            finally:
                terminate()
                (output / 'boot-verification.json').write_text(json.dumps(record, indent=2) + '\n')
    print('APPLIANCE_PHASE:' + ('verified' if record['bootVerified'] else 'unverified'), flush=True)
    return 0 if record['bootVerified'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--iso', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args()
    try:
        raise SystemExit(verify(options.iso, options.sha256, options.output))
    except (ValueError, OSError, subprocess.SubprocessError):
        print('Appliance boot verification could not complete.', file=sys.stderr)
        sys.exit(1)
