#!/usr/bin/env python3
"""Launch and cancel only an identity-verified, isolated appliance process group."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def identity(pid):
    try:
        # The comm field may contain spaces and parentheses.
        fields = Path('/proc/%s/stat' % pid).read_text().rsplit(')', 1)[1].split()
        return {'pid': pid, 'pgid': int(fields[2]), 'starttime': fields[19], 'uid': Path('/proc/%s' % pid).stat().st_uid}
    except FileNotFoundError:
        return None


def members(record):
    found = []
    for path in Path('/proc').iterdir():
        if path.name.isdecimal():
            item = identity(int(path.name))
            if item and item['pgid'] == record['pgid']:
                found.append(item)
    return found


def control(receipt, action):
    if receipt.is_symlink() or receipt.stat().st_uid != os.getuid():
        return {'state': 'identity-mismatch'}
    record = json.loads(receipt.read_text())
    current = identity(record['pid'])
    group = members(record)
    if not group:
        return {'state': 'verified-stopped'}
    if current != record or record['pgid'] != record['pid'] or record['uid'] != os.getuid() or any(item['uid'] != record['uid'] for item in group):
        # A missing leader with surviving members is ambiguous, never stopped.
        return {'state': 'identity-mismatch'}
    if action == 'status':
        return {'state': 'running'}
    os.killpg(current['pgid'], signal.SIGTERM)
    for _ in range(50):
        if not members(record):
            return {'state': 'verified-stopped'}
        time.sleep(0.1)
    if identity(current['pid']) == current:
        os.killpg(current['pgid'], signal.SIGKILL)
    return {'state': 'running' if members(record) else 'verified-stopped'}


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--launch':
        script, spec, output = sys.argv[2:]
        destination = Path(output)
        destination.mkdir(parents=True, exist_ok=True)
        receipt = destination / 'process.json'
        if receipt.exists():
            raise SystemExit('A process receipt already exists; use a fresh output directory')
        process = subprocess.Popen(['bash', script, '--spec', spec, '--output', output], start_new_session=True,
                                   env={**os.environ, 'MATERIAL_APPLIANCE_WORKER': '1'})
        record = identity(process.pid)
        if record is None:
            raise SystemExit(process.wait() or 1)
        receipt.write_text(json.dumps(record))
        receipt.chmod(0o600)
        try:
            raise SystemExit(process.wait())
        finally:
            # A dying launcher must not leave source compilers behind.
            if process.poll() is None:
                control(receipt, 'cancel')
    parser = argparse.ArgumentParser()
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--action', choices=['cancel', 'status'], required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(control(args.receipt, args.action)))
    except (KeyError, ValueError, OSError):
        print(json.dumps({'state': 'identity-mismatch'}))
        sys.exit(1)
