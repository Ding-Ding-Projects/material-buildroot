"""Persistent owner identity and bounded in-memory console sessions."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time


class State:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.owner = self.root / 'owner.json'
        self.sessions = {}
        self.bootstrap = secrets.token_urlsafe(32)
        self.next_attempt = 0
        self.failures = 0

    def password(self, value):
        if not isinstance(value, str) or not 12 <= len(value) <= 1024:
            raise ValueError('Use a password between 12 and 1024 characters.')
        return value.encode('utf-8')

    def enroll(self, password):
        raw = self.password(password)
        salt = secrets.token_bytes(32)
        record = {'salt': salt.hex(), 'digest': hashlib.pbkdf2_hmac('sha256', raw, salt, 600000).hex()}
        # Exclusive creation prevents a second enrollment replacing the owner.
        fd = os.open(self.owner, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(record, stream)
            stream.flush()
            os.fsync(stream.fileno())

    def login(self, password):
        now = time.monotonic()
        if now < self.next_attempt:
            raise ValueError('Please wait before trying again.')
        self.next_attempt = now + 1
        try:
            record = json.loads(self.owner.read_text(encoding='utf-8'))
            actual = hashlib.pbkdf2_hmac('sha256', self.password(password), bytes.fromhex(record['salt']), 600000).hex()
            valid = hmac.compare_digest(actual, record['digest'])
        except (OSError, ValueError, KeyError):
            valid = False
        if not valid:
            self.failures = min(self.failures + 1, 8)
            self.next_attempt = now + min(60, 2 ** self.failures)
            raise ValueError('Sign-in did not succeed.')
        self.failures = 0
        self.sessions.clear()
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        self.sessions[token] = (csrf, time.monotonic() + 1800)
        return token, csrf

    def session(self, token):
        record = self.sessions.get(token)
        if record and record[1] > time.monotonic():
            return record[0]
        self.sessions.pop(token, None)
        return None

    def setup_stage(self):
        try:
            stage = (self.root / 'setup-progress').read_text(encoding='utf-8')
            return stage if stage in ('workload', 'access', 'complete') else 'workload'
        except OSError:
            return 'workload'

    def setup_verification(self):
        try:
            value = (self.root / 'setup-verification').read_text(encoding='utf-8')
            return value if value in ('no-web', 'http-response') else 'pending'
        except OSError:
            return 'pending'

    def save_setup_stage(self, stage, verification=None):
        if stage not in ('workload', 'access', 'complete'):
            raise ValueError('Invalid setup stage.')
        temporary = self.root / 'setup-progress.new'
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(stage)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, self.root / 'setup-progress')
        if stage == 'complete' and verification in ('no-web', 'http-response'):
            fd = os.open(self.root / 'setup-verification', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(verification)
