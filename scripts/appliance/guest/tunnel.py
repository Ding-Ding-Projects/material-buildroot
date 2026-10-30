"""Explicit, owned tunnel lifecycle. Child output is never returned to the browser."""
import os
import json
from pathlib import Path
import re
import shutil
import subprocess
import threading


class Tunnel:
    def __init__(self, root, target):
        self.root = Path(root)
        self.target = target
        self.process = None
        self.mode = 'off'
        self.address = None

    def status(self):
        alive = self.process is not None and self.process.poll() is None
        return {'mode': self.mode, 'running': alive, 'address': self.address,
                'state': 'running' if alive else ('off' if self.mode == 'off' else 'exited'),
                'publicVerified': False, 'available': bool(shutil.which('cloudflared'))}

    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=3)
        self.process = None
        self.mode = 'off'
        self.address = None

    def start(self, mode, token=''):
        if mode not in ('quick', 'named'):
            raise ValueError('Select a supported access mode.')
        executable = shutil.which('cloudflared')
        if not executable:
            raise ValueError('The tunnel client is not installed in this image.')
        args = [executable, 'tunnel', '--no-autoupdate']
        if mode == 'named':
            if not isinstance(token, str) or len(token) > 8192:
                raise ValueError('Enter locally managed tunnel credentials.')
            credential = json.loads(token)
            if not isinstance(credential, dict) or set(credential) != {'AccountTag', 'TunnelSecret', 'TunnelID'}:
                raise ValueError('Locally managed tunnel credentials are required.')
            if not isinstance(credential['AccountTag'], str) or not re.fullmatch(r'[a-fA-F0-9]{32}', credential['AccountTag']):
                raise ValueError('Invalid credential format.')
            if not isinstance(credential['TunnelID'], str) or not re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}', credential['TunnelID']):
                raise ValueError('Invalid credential format.')
            if not isinstance(credential['TunnelSecret'], str) or not re.fullmatch(r'[A-Za-z0-9+/=]{20,256}', credential['TunnelSecret']):
                raise ValueError('Invalid credential format.')
            self.stop()
            self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(self.root, 0o700)
            path = self.root / 'credential.json'
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            os.chmod(path, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(credential, stream)
            config = self.root / 'config.json'
            fd = os.open(config, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            os.chmod(config, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                # JSON is a YAML subset; a local catch-all fixes every origin to the workload.
                json.dump({'tunnel': credential['TunnelID'], 'credentials-file': str(path),
                           'ingress': [{'service': self.target}]}, stream)
            args += ['--config', str(config), 'run', credential['TunnelID']]
        else:
            args += ['--url', self.target]
        self.stop()
        self.process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
        self.mode = mode
        process = self.process
        # Only a strictly allowlisted temporary endpoint survives child output.
        def read_address():
            while True:
                line = process.stderr.readline(16384)
                if not line:
                    break
                found = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com\b', line)
                if found and self.process is process and mode == 'quick':
                    self.address = found.group(0)
            process.stderr.close()
        threading.Thread(target=read_address, daemon=True).start()
