"""Workload-only TLS and owner enrollment. Protected values never leave this module."""
import hashlib
import hmac
from html.parser import HTMLParser
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import stat
import subprocess
import time
from urllib.parse import urlencode, urlsplit


class EnrollmentUnavailable(ValueError):
    def __init__(self):
        super().__init__('Protected workload setup is unavailable. Check the owned workload state.')


class SetupForm(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = 0
        self.inside = False
        self.fields = []
        self.csrf = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'form':
            self.forms += 1
            if attrs.get('method', '').lower() != 'post' or attrs.get('action', '') != '':
                raise EnrollmentUnavailable()
            self.inside = True
        if tag == 'input' and self.inside:
            name = attrs.get('name')
            if name:
                self.fields.append(name)
            if name == 'csrf':
                if attrs.get('type') != 'hidden' or not re.fullmatch(r'[A-Za-z0-9_-]{43}', attrs.get('value', '')):
                    raise EnrollmentUnavailable()
                self.csrf = attrs['value']

    def handle_endtag(self, tag):
        if tag == 'form':
            self.inside = False

    def validate(self):
        if self.forms != 1 or sorted(self.fields) != ['confirm', 'csrf', 'password', 'username'] or not self.csrf:
            raise EnrollmentUnavailable()
        return self.csrf


def loopback_https(value, origin=False):
    if not isinstance(value, str) or len(value) > 2048 or any(ord(c) < 33 for c in value):
        raise EnrollmentUnavailable()
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1')
            or not parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment
            or (origin and parsed.path not in ('', '/'))):
        raise EnrollmentUnavailable()
    return parsed


class Enrollment:
    def __init__(self, metadata):
        self.metadata = metadata
        self.pending = {}
        for key in ('composeProject', 'service', 'volume'):
            if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{0,100}', metadata.get(key, '')):
                raise EnrollmentUnavailable()
        if metadata['service'] != 'initialize' or metadata['volume'] != 'owner-config':
            raise EnrollmentUnavailable()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', metadata.get('imageId', '')) or not re.fullmatch(r'[a-f0-9]{40,64}', metadata.get('sourceRevision', '')):
            raise EnrollmentUnavailable()
        self.productive = loopback_https(metadata.get('productiveUrl'))
        self.setup = loopback_https(metadata.get('setupOrigin'), origin=True)
        if self.productive.netloc == self.setup.netloc:
            raise EnrollmentUnavailable()

    def command(self, *args):
        executable = shutil.which('docker')
        if not executable:
            raise EnrollmentUnavailable()
        result = subprocess.run([executable, *args], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=4)
        if result.returncode != 0 or len(result.stdout) > 65536:
            raise EnrollmentUnavailable()
        return result.stdout.decode('utf-8').strip()

    def owned_directory(self):
        m = self.metadata
        ids = self.command('ps', '-aq', '--filter', f'label=com.docker.compose.project={m["composeProject"]}',
                           '--filter', f'label=com.docker.compose.service={m["service"]}').splitlines()
        if len(ids) != 1 or not re.fullmatch(r'[a-f0-9]{12,64}', ids[0]):
            raise EnrollmentUnavailable()
        info = json.loads(self.command('inspect', '--format', '{{json .Config.Labels}}', ids[0]))
        if info.get('com.docker.compose.project') != m['composeProject'] or info.get('com.docker.compose.service') != m['service']:
            raise EnrollmentUnavailable()
        image = self.command('inspect', '--format', '{{.Image}}', ids[0])
        if image != m['imageId']:
            raise EnrollmentUnavailable()
        revision = self.command('image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', image)
        if revision != m['sourceRevision']:
            raise EnrollmentUnavailable()
        mounts = json.loads(self.command('inspect', '--format', '{{json .Mounts}}', ids[0]))
        owners = [item for item in mounts if item.get('Destination') == '/run/owner' and item.get('Type') == 'volume']
        if len(owners) != 1 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,200}', owners[0].get('Name', '')):
            raise EnrollmentUnavailable()
        volume = owners[0]['Name']
        labels = json.loads(self.command('volume', 'inspect', '--format', '{{json .Labels}}', volume))
        if labels.get('com.docker.compose.project') != m['composeProject'] or labels.get('com.docker.compose.volume') != m['volume']:
            raise EnrollmentUnavailable()
        directory = Path(self.command('volume', 'inspect', '--format', '{{.Mountpoint}}', volume))
        if not directory.is_absolute() or directory.resolve() != directory or not directory.is_dir() or owners[0].get('Source') != str(directory):
            raise EnrollmentUnavailable()
        return directory

    def read_owned(self, directory, name, maximum):
        if name not in ('tls-cert.pem', 'setup-access-url'):
            raise EnrollmentUnavailable()
        path = directory / name
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_mode & 0o077 or not 0 < before.st_size <= maximum:
            raise EnrollmentUnavailable()
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(descriptor, 'rb') as source:
            current = os.fstat(source.fileno())
            if (current.st_dev, current.st_ino) != (before.st_dev, before.st_ino):
                raise EnrollmentUnavailable()
            value = source.read(maximum + 1)
        if len(value) > maximum:
            raise EnrollmentUnavailable()
        return value

    def certificate(self, directory):
        pem = self.read_owned(directory, 'tls-cert.pem', 16384).decode('ascii')
        if pem.count('-----BEGIN CERTIFICATE-----') != 1 or pem.count('-----END CERTIFICATE-----') != 1:
            raise EnrollmentUnavailable()
        der = ssl.PEM_cert_to_DER_cert(pem)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        context.hostname_checks_common_name = False
        context.load_verify_locations(cadata=pem)
        return context, hashlib.sha256(der).digest()

    def request(self, url, context, certificate_digest, body=None):
        target = loopback_https(url)
        if target.netloc not in (self.productive.netloc, self.setup.netloc):
            raise EnrollmentUnavailable()
        connection = http.client.HTTPSConnection(target.hostname, target.port, context=context, timeout=4)
        try:
            connection.connect()
            if not hmac.compare_digest(hashlib.sha256(connection.sock.getpeercert(binary_form=True)).digest(), certificate_digest):
                raise EnrollmentUnavailable()
            headers = {'Host': target.netloc}
            if body is not None:
                headers.update({'Origin': f'https://{target.netloc}', 'Content-Type': 'application/x-www-form-urlencoded'})
            connection.request('GET' if body is None else 'POST', target.path or '/', body=body, headers=headers)
            response = connection.getresponse()
            data = response.read(2 * 1024 * 1024 + 1)
            if len(data) > 2 * 1024 * 1024:
                raise EnrollmentUnavailable()
            return response.status, data
        finally:
            connection.close()

    def prepare(self, session):
        directory = self.owned_directory()
        context, digest = self.certificate(directory)
        route = self.read_owned(directory, 'setup-access-url', 2048).decode('utf-8').strip()
        parsed = loopback_https(route)
        if parsed.netloc != self.setup.netloc or not re.fullmatch(r'/setup/[A-Za-z0-9_-]{43}', parsed.path):
            raise EnrollmentUnavailable()
        status, page = self.request(route, context, digest)
        if status != 200:
            raise EnrollmentUnavailable()
        form = SetupForm()
        form.feed(page.decode('utf-8'))
        csrf = form.validate()
        self.pending.clear()
        self.pending[session] = (route, csrf, digest, time.monotonic() + 300)

    def submit(self, session, fields):
        pending = self.pending.pop(session, None)
        if not pending or pending[3] <= time.monotonic() or set(fields) != {'username', 'password', 'confirm'}:
            raise EnrollmentUnavailable()
        if (not all(isinstance(value, str) for value in fields.values()) or not fields['username'].strip()
                or len(fields['username']) > 128 or not 12 <= len(fields['password']) <= 1024
                or fields['password'] != fields['confirm']):
            raise EnrollmentUnavailable()
        directory = self.owned_directory()
        context, digest = self.certificate(directory)
        if not hmac.compare_digest(pending[2], digest):
            raise EnrollmentUnavailable()
        current = self.read_owned(directory, 'setup-access-url', 2048).decode('utf-8').strip()
        if current != pending[0]:
            raise EnrollmentUnavailable()
        body = urlencode({**fields, 'csrf': pending[1]}).encode('utf-8')
        if len(body) > 8192:
            raise EnrollmentUnavailable()
        status, _ = self.request(current, context, digest, body)
        if status != 200:
            raise EnrollmentUnavailable()

    def healthy(self):
        try:
            context, digest = self.certificate(self.owned_directory())
            status, _ = self.request(self.metadata['productiveUrl'], context, digest)
            return status in (200, 301, 302, 303, 307, 308, 401, 403)
        except (OSError, ValueError, TypeError, KeyError, ssl.SSLError, http.client.HTTPException, subprocess.SubprocessError):
            return False
