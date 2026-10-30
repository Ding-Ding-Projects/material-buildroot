"""Loopback-only management console for the booted appliance."""
import argparse
import hmac
import http.client
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import mimetypes
import shutil
from pathlib import Path
import signal
import subprocess
import urllib.request
import urllib.error
from urllib.parse import urlsplit

from state import State
from tunnel import Tunnel
from enrollment import Enrollment, EnrollmentUnavailable


def workload_url(value):
    parts = urlsplit(value)
    if parts.scheme not in ('http', 'https') or parts.hostname not in ('127.0.0.1', 'localhost', '::1') or parts.username or parts.password or not parts.port:
        raise ValueError('Workload URL must use an explicit loopback port.')
    if parts.port == 8766 or parts.fragment:
        raise ValueError('Workload URL cannot target the management console.')
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ConsoleServer(HTTPServer):
    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address


def healthy(target):
    if target is None:
        return False
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(target, timeout=2) as response:
            return 200 <= response.status < 400
    except urllib.error.HTTPError as error:
        return error.code in (301, 302, 303, 307, 308, 401, 403)
    except Exception:
        return False


def container_status(config):
    # The producer owns this exact single-container name; Compose names vary.
    if config.get('compose') is not False:
        return 'unknown'
    executable = shutil.which('docker')
    if not executable:
        return 'unavailable'
    try:
        result = subprocess.run([executable, 'container', 'inspect', '--format', '{{.State.Running}}',
                                 'material-workload'], capture_output=True, timeout=3, text=True)
        if result.returncode == 0 and result.stdout.strip() in ('true', 'false'):
            return 'running' if result.stdout.strip() == 'true' else 'stopped'
    except (OSError, subprocess.TimeoutExpired):
        pass
    return 'unknown'


def create_server(config, data, port=8766, seed='/opt/material/personal-vocabulary.json', static_root=None):
    no_web = config.get('mode') == 'console' and config.get('kioskUrl') == ''
    target = None if no_web else workload_url(config.get('kioskUrl', 'http://127.0.0.1:8080/'))
    state = State(Path(data) / 'portal')
    tunnel = Tunnel(Path(data) / 'tunnel', target)
    enrollment_configured = isinstance(config.get('enrollment'), dict)
    enrollment = None
    if enrollment_configured:
        try:
            if config['enrollment'].get('productiveUrl') != target:
                raise EnrollmentUnavailable()
            enrollment = Enrollment(config['enrollment'])
        except (ValueError, TypeError):
            pass

    def productive_health():
        if enrollment_configured:
            return enrollment.healthy() if enrollment else False
        return healthy(target)
    static = Path(static_root or Path(__file__).parent / 'static').resolve()
    allowed = {'/': ('index.html', 'text/html'), '/console.js': ('console.js', 'text/javascript'),
               '/console.css': ('console.css', 'text/css'), '/vocabulary.mjs': ('vocabulary.mjs', 'text/javascript')}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def accepted_host(self):
            return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

        def session_token(self):
            value = self.headers.get('Authorization', '')
            return value[7:] if value.startswith('Bearer ') else ''

        def reply(self, status, body, mime='application/json', cookie=None):
            raw = body if isinstance(body, bytes) else json.dumps(body).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime + '; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")
            if cookie:
                self.send_header('Set-Cookie', cookie)
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if not self.accepted_host():
                return self.reply(403, {'error': 'Invalid console host.'})
            csrf = state.session(self.session_token())
            if self.path in allowed:
                filename, mime = allowed[self.path]
                return self.reply(200, (static / filename).read_bytes(), mime)
            if self.path.startswith('/assets/'):
                candidate = (static / self.path.lstrip('/')).resolve()
                if candidate.is_relative_to(static / 'assets') and candidate.is_file() and candidate.suffix in ('.js', '.css', '.woff2'):
                    return self.reply(200, candidate.read_bytes(), mimetypes.guess_type(candidate)[0] or 'application/octet-stream')
                return self.reply(404, {'error': 'Unknown asset.'})
            if self.path == '/api/session':
                return self.reply(200, {'setup': not state.owner.exists(), 'authenticated': bool(csrf), 'csrf': csrf or state.bootstrap})
            if not csrf:
                return self.reply(401, {'error': 'Sign in to continue.'})
            if self.path == '/api/status':
                return self.reply(200, {'name': str(config.get('name', 'Application'))[:120], 'target': target,
                                        'healthy': productive_health(), 'webAvailable': not no_web,
                                        'enrollmentAvailable': enrollment is not None,
                                        'scopedTls': enrollment_configured, 'browserTlsReady': not enrollment_configured,
                                        'containerState': container_status(config), 'httpProof': 'not-applicable' if no_web else 'current-response-check',
                                        'tunnel': tunnel.status(), 'setupStage': state.setup_stage(),
                                        'setupVerification': state.setup_verification()})
            if self.path == '/api/seed':
                path = Path(seed)
                if not path.is_file() or path.stat().st_size > 256 * 1024:
                    return self.reply(404, {'error': 'No local language data available.'})
                return self.reply(200, path.read_bytes())
            return self.reply(404, {'error': 'Unknown action.'})

        def do_POST(self):
            # Consume only a bounded body before a rejection, so closing the socket
            # cannot reset a response while the client is still transmitting it.
            try:
                lengths = self.headers.get_all('Content-Length', [])
                length = int(lengths[0]) if len(lengths) == 1 else 0
                if not 0 < length <= 16384 or self.headers.get('Transfer-Encoding'):
                    return self.reply(400, {'error': 'Invalid request size or encoding.'})
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError('Incomplete request.')
            except (ValueError, OSError, TimeoutError):
                return self.reply(400, {'error': 'Request could not be read.'})
            if not self.accepted_host() or self.headers.get('Origin') != f'http://127.0.0.1:{self.server.server_port}':
                return self.reply(403, {'error': 'Invalid console origin.'})
            session = self.session_token()
            csrf = state.session(session)
            auth_route = self.path in ('/api/setup', '/api/login')
            if not auth_route and not csrf:
                return self.reply(401, {'error': 'Sign in to continue.'})
            expected = state.bootstrap if auth_route else csrf
            if not expected or not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), expected):
                return self.reply(403, {'error': 'Refresh the console and sign in again.'})
            try:
                if self.headers.get('Content-Type') != 'application/json':
                    raise ValueError('JSON input is required.')
                body = json.loads(raw)
                if not isinstance(body, dict):
                    raise ValueError('An object is required.')
                if auth_route:
                    if self.path == '/api/setup':
                        state.enroll(body.get('password'))
                    token, value = state.login(body.get('password'))
                    if enrollment:
                        enrollment.pending.clear()
                    return self.reply(200, {'csrf': value, 'authorization': token})
                if self.path == '/api/logout':
                    state.sessions.pop(session, None)
                    if enrollment:
                        enrollment.pending.pop(session, None)
                    return self.reply(200, {})
                if self.path == '/api/workload-enrollment/start':
                    if not enrollment:
                        raise EnrollmentUnavailable()
                    enrollment.prepare(session)
                    return self.reply(200, {'ready': True})
                if self.path == '/api/workload-enrollment/cancel':
                    if enrollment:
                        enrollment.pending.pop(session, None)
                    return self.reply(200, {'ready': False})
                if self.path == '/api/workload-enrollment/submit':
                    try:
                        if not enrollment:
                            raise EnrollmentUnavailable()
                        enrollment.submit(session, body)
                        return self.reply(200, {'saved': True, 'productiveHealthy': productive_health()})
                    finally:
                        body.clear()
                        raw = b''
                if self.path == '/api/tunnel':
                    mode = body.get('mode')
                    if mode == 'off':
                        tunnel.stop()
                    else:
                        if no_web or enrollment_configured:
                            raise ValueError('Public access is unavailable for this workload configuration.')
                        if body.get('publicConsent') is not True or body.get('authenticationConfirmed') is not True:
                            raise ValueError('Confirm public access and workload authentication first.')
                        if not productive_health():
                            raise ValueError('The application must respond before remote access starts.')
                        tunnel.start(mode, body.get('credential', ''))
                    return self.reply(200, tunnel.status())
                if self.path == '/api/setup-progress':
                    stage = body.get('stage')
                    if stage not in ('workload', 'access', 'complete'):
                        raise ValueError('Invalid setup stage.')
                    if stage in ('access', 'complete'):
                        if no_web and body.get('noWebAcknowledged') is not True:
                            raise ValueError('Explicitly continue without web verification.')
                        if not no_web and not productive_health():
                            raise ValueError('The application must respond before setup continues.')
                    if stage == 'complete' and tunnel.status()['state'] not in ('off', 'running'):
                        raise ValueError('Stop the unavailable tunnel or retry before completing setup.')
                    state.save_setup_stage(stage, 'no-web' if no_web else 'http-response')
                    return self.reply(200, {'setupStage': stage})
                return self.reply(404, {'error': 'Unknown action.'})
            except FileExistsError:
                return self.reply(409, {'error': 'An owner already exists. Sign in instead.'})
            except (ValueError, TypeError, KeyError):
                return self.reply(400, {'error': 'Action could not complete. Check input and application readiness.'})
            except (OSError, TimeoutError, http.client.HTTPException, subprocess.TimeoutExpired):
                return self.reply(503, {'error': 'Local storage or process operation did not complete.'})

    server = ConsoleServer(('127.0.0.1', port), Handler)
    server.state, server.tunnel, server.enrollment = state, tunnel, enrollment
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/opt/material/runtime.json')
    parser.add_argument('--data', default='/data')
    parser.add_argument('--static-root', default=None)
    args = parser.parse_args()
    service = create_server(json.loads(Path(args.config).read_text()), args.data, static_root=args.static_root)
    def stop(*_):
        service.tunnel.stop()
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stop)
    try:
        service.serve_forever()
    finally:
        service.tunnel.stop()
        service.server_close()
