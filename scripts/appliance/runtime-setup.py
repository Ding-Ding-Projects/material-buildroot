#!/usr/bin/env python3
"""Generate installation-local Compose credentials without embedding or printing them."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys


def setup(config, data):
    required = config.get('runtimeSetup', {})
    if not required:
        return
    if required != {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True} or config.get('adapter') != 'job-2027-upstream':
        raise ValueError('Unsupported installation setup')
    directory = data / 'workload'
    if directory.is_symlink():
        raise ValueError('Unsafe installation storage')
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    destination = directory / 'runtime.env'
    if destination.is_symlink():
        raise ValueError('Unsafe installation credential file')
    if destination.exists():
        if not destination.is_file() or destination.stat().st_size > 256:
            raise ValueError('Invalid installation credential file')
        if not re.fullmatch(r'JOB_POSTGRES_PASSWORD=[A-Za-z0-9_-]{64}\n', destination.read_text()):
            raise ValueError('Invalid installation credential file')
        destination.chmod(0o600)
        return
    existing = subprocess.run(['docker', 'volume', 'ls', '--quiet'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
    if existing.strip():
        raise ValueError('Fresh installation requires an empty data engine; existing volumes were preserved')
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'w') as handle:
        handle.write('JOB_POSTGRES_PASSWORD=' + secrets.token_urlsafe(48) + '\n')
        handle.flush()
        os.fsync(handle.fileno())


if __name__ == '__main__':
    try:
        setup(json.loads(Path('/opt/material/runtime.json').read_text()), Path('/data'))
    except (ValueError, OSError, subprocess.SubprocessError):
        print('Installation setup could not complete; existing data was preserved.', file=sys.stderr)
        sys.exit(1)
