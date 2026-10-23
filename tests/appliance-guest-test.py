"""Exercise the real loopback HTTP boundary using disposable owner data."""
import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock
import io

ROOT = Path(__file__).resolve().parents[1] / 'scripts/appliance/guest'
sys.path.insert(0, str(ROOT))
from server import create_server, workload_url, container_status
from tunnel import Tunnel


class ConsoleTest(unittest.TestCase):
    configuration = {'kioskUrl': 'http://127.0.0.1:9/'}
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.seed = Path(self.temp.name) / 'language.json'
        self.seed.write_text('{"schemaVersion":1,"entries":{"Application":"Workspace"}}')
        self.server = create_server(self.configuration, self.temp.name, 0, self.seed)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
        self.authorization = ''
        self.csrf = self.request('GET', '/api/session')[1]['csrf']

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        base = {'Origin': f'http://127.0.0.1:{self.port}', 'X-CSRF-Token': getattr(self, 'csrf', ''), 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + self.authorization}
        base.update(headers or {})
        connection.request(method, path, body=None if body is None else json.dumps(body), headers=base)
        response = connection.getresponse()
        raw = response.read()
        self.assertIsNone(response.getheader('Set-Cookie'))
        status = response.status
        connection.close()
        return status, json.loads(raw)

    def enroll(self):
        code, body = self.request('POST', '/api/setup', {'password': 'test-only-password-123'})
        self.assertEqual(code, 200)
        self.csrf = body['csrf']
        self.authorization = body['authorization']

    def test_protected_seed_and_status(self):
        self.assertEqual(self.request('GET', '/api/seed')[0], 401)
        self.assertEqual(self.request('GET', '/api/status')[0], 401)
        self.enroll()
        self.assertEqual(self.request('GET', '/api/seed')[0], 200)
        status = self.request('GET', '/api/status')[1]
        self.assertFalse(status['healthy'])
        self.assertEqual(status['tunnel']['state'], 'off')
        self.request('POST', '/api/logout', {})
        self.assertEqual(self.request('GET', '/api/seed')[0], 401)

    def test_host_origin_csrf_and_enrollment(self):
        self.assertEqual(self.request('GET', '/api/session', headers={'Host':'attacker.invalid'})[0], 403)
        body = {'password': 'test-only-password-123'}
        self.assertEqual(self.request('POST', '/api/setup', body, {'Origin':''})[0], 403)
        self.assertEqual(self.request('POST', '/api/setup', body, {'X-CSRF-Token':'wrong'})[0], 403)
        bootstrap = self.csrf
        self.enroll()
        self.assertEqual(self.request('POST', '/api/setup', body, {'X-CSRF-Token':bootstrap})[0], 409)
        self.assertEqual(self.request('POST', '/api/tunnel', {'mode':'quick'})[0], 400)
        self.assertEqual(self.request('POST', '/api/tunnel', {'mode':'quick','publicConsent':True,'authenticationConfirmed':True})[0], 400)

    def test_expiry(self):
        self.enroll()
        token = self.authorization
        self.server.state.sessions[token] = (self.csrf, 0)
        self.assertEqual(self.request('GET', '/api/seed')[0], 401)
        self.assertEqual(self.request('POST', '/api/tunnel', {'mode':'off'})[0], 401)

    def test_target_is_fixed_loopback(self):
        for url in ['http://example.com:8080/', 'file:///etc/passwd', 'http://127.0.0.1:8766/', 'http://user:pass@127.0.0.1:8080/', 'http://127.0.0.1/']:
            with self.assertRaises(ValueError):
                workload_url(url)

    def test_setup_progress_is_protected_persistent_and_health_gated(self):
        self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'complete'})[0],401)
        self.enroll()
        self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'access'})[0],400)
        with patch('server.healthy', return_value=True):
            self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'access'})[0],200)
            self.assertEqual((Path(self.temp.name)/'portal/setup-progress').read_text(),'access')
            self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'workload'})[0],200)
            self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'complete'})[0],200)
            self.assertEqual(self.request('GET','/api/status')[1]['setupStage'],'complete')
        self.assertEqual(self.request('POST', '/api/setup-progress', {'stage':'injected'})[0],400)

    def test_named_tunnel_has_only_fixed_local_ingress(self):
        class Child:
            def __init__(self):
                self.stderr = io.StringIO('')
                self.exited = False
            def poll(self):
                return 0 if self.exited else None
            def terminate(self):
                self.exited = True
            def wait(self, timeout):
                return 0
        credential = {'AccountTag':'a'*32,'TunnelSecret':'b'*40,
                      'TunnelID':'12345678-1234-1234-1234-123456789abc'}
        manager = Tunnel(Path(self.temp.name)/'tunnel', 'http://127.0.0.1:8123/')
        child = Child()
        with patch('tunnel.shutil.which', return_value='/usr/bin/cloudflared'), patch('tunnel.subprocess.Popen', return_value=child) as launch:
            manager.start('named', json.dumps(credential))
            args = launch.call_args.args[0]
            self.assertNotIn(credential['TunnelSecret'], ' '.join(args))
            self.assertNotIn('env', launch.call_args.kwargs)
            config = json.loads((manager.root/'config.json').read_text())
            self.assertEqual(config['ingress'], [{'service':'http://127.0.0.1:8123/'}])
            self.assertTrue(manager.status()['running'])
            manager.stop()
            self.assertTrue(child.exited)
            self.assertEqual(manager.status()['state'], 'off')
            with self.assertRaises(ValueError):
                manager.start('named', 'remote-connector-token')


class NoWebTest(unittest.TestCase):
    setUp = ConsoleTest.setUp
    tearDown = ConsoleTest.tearDown
    request = ConsoleTest.request
    enroll = ConsoleTest.enroll
    configuration = {'mode':'console','kioskUrl':'','compose':False}

    def test_no_web_setup_and_tunnels(self):
        self.enroll()
        with patch('server.shutil.which', return_value=None):
            status = self.request('GET','/api/status')[1]
        self.assertIsNone(status['target'])
        self.assertFalse(status['healthy'])
        self.assertFalse(status['webAvailable'])
        self.assertEqual(status['containerState'],'unavailable')
        self.assertEqual(self.request('POST','/api/setup-progress',{'stage':'complete'})[0],400)
        self.assertEqual(self.request('POST','/api/setup-progress',{'stage':'access','noWebAcknowledged':True})[0],200)
        self.assertEqual(self.request('POST','/api/setup-progress',{'stage':'complete','noWebAcknowledged':True})[0],200)
        self.assertEqual(self.server.state.setup_verification(),'no-web')
        with patch('server.healthy',return_value=True), patch.object(self.server.tunnel,'start') as start:
            for mode in ('quick','named'):
                self.assertEqual(self.request('POST','/api/tunnel',{'mode':mode,'publicConsent':True,'authenticationConfirmed':True})[0],400)
            start.assert_not_called()
        self.assertEqual(self.request('GET','/api/seed')[0],200)

    def test_container_probe_is_fixed_and_bounded(self):
        from types import SimpleNamespace
        with patch('server.shutil.which',return_value='/usr/bin/docker'), patch('server.subprocess.run',return_value=SimpleNamespace(returncode=0,stdout='true\n')) as run:
            self.assertEqual(container_status({'compose':False}),'running')
            self.assertEqual(run.call_args.args[0][-1],'material-workload')
            self.assertEqual(run.call_args.kwargs['timeout'],3)
            self.assertEqual(container_status({'compose':True}),'unknown')


class EnrollmentApiTest(unittest.TestCase):
    tearDown = ConsoleTest.tearDown
    request = ConsoleTest.request
    enroll = ConsoleTest.enroll
    configuration = {'kioskUrl':'https://127.0.0.1:19002/', 'enrollment':{'productiveUrl':'https://127.0.0.1:19002/'}}

    def setUp(self):
        self.enrollment = Mock()
        self.enrollment.pending = {}
        self.enrollment.healthy.return_value = False
        with patch('server.Enrollment', return_value=self.enrollment):
            ConsoleTest.setUp(self)

    def test_enrollment_authentication_and_payload_free_results(self):
        self.assertEqual(self.request('POST','/api/workload-enrollment/start',{})[0],401)
        self.enrollment.prepare.assert_not_called()
        self.enroll()
        self.assertEqual(self.request('POST','/api/workload-enrollment/start',{}),(200,{'ready':True}))
        received = []
        self.enrollment.submit.side_effect = lambda session,fields: received.append((session,set(fields)))
        result = self.request('POST','/api/workload-enrollment/submit',{'username':'test-owner','password':'test-only-password','confirm':'test-only-password'})
        self.assertEqual(result,(200,{'saved':True,'productiveHealthy':False}))
        self.assertEqual(received,[(self.authorization,{'username','password','confirm'})])
        status = self.request('GET','/api/status')[1]
        self.assertTrue(status['scopedTls'])
        self.assertFalse(status['browserTlsReady'])
        self.assertNotIn('enrollment',status)
        with patch.object(self.server.tunnel,'start') as start:
            self.enrollment.healthy.return_value = True
            self.assertEqual(self.request('POST','/api/tunnel',{'mode':'quick','publicConsent':True,'authenticationConfirmed':True})[0],400)
            start.assert_not_called()
        self.enrollment.pending[self.authorization] = 'test-only-context'
        self.request('POST','/api/logout',{})
        self.assertEqual(self.enrollment.pending,{})


if __name__ == '__main__':
    unittest.main()
