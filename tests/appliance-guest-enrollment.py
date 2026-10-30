"""Enrollment identity, private-route, form and real scoped-TLS regression checks."""
import http.server
import json
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/appliance/guest'))
from enrollment import Enrollment, EnrollmentUnavailable, SetupForm


def metadata(setup='https://127.0.0.1:19001'):
    return {'composeProject':'test-owned', 'service':'initialize', 'volume':'owner-config',
            'imageId':'sha256:'+'a'*64, 'sourceRevision':'b'*40,
            'productiveUrl':'https://127.0.0.1:19002/', 'setupOrigin':setup}


class IdentityTests(unittest.TestCase):
    def test_exact_owned_container_image_revision_mount_and_volume(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            owner = Enrollment(metadata())
            answers = ['c'*64, json.dumps({'com.docker.compose.project':'test-owned','com.docker.compose.service':'initialize'}),
                       'sha256:'+'a'*64, 'b'*40,
                       json.dumps([{'Destination':'/run/owner','Type':'volume','Name':'owned-volume','Source':str(directory)}]),
                       json.dumps({'com.docker.compose.project':'test-owned','com.docker.compose.volume':'owner-config'}), str(directory)]
            with patch.object(owner,'command',side_effect=answers):
                self.assertEqual(owner.owned_directory(), directory)
            for index, bad in ((0,'c'*64+'\n'+'d'*64),(1,'{}'),(2,'sha256:'+'d'*64),(3,'e'*40),(4,'[]'),(5,'{}')):
                changed = answers.copy(); changed[index] = bad
                with patch.object(owner,'command',side_effect=changed), self.assertRaises(EnrollmentUnavailable):
                    owner.owned_directory()

    def test_unapproved_metadata_and_file_names_are_rejected(self):
        for change in ({'service':'web'},{'volume':'database-config'},{'imageId':'latest'},
                       {'sourceRevision':'unverified'},{'setupOrigin':'http://127.0.0.1:19001'},
                       {'setupOrigin':'https://example.invalid:19001'}):
            with self.assertRaises(EnrollmentUnavailable):
                Enrollment({**metadata(), **change})
        owner = Enrollment(metadata())
        for name in ('owner.json','tls-key.pem','database-password','../tls-cert.pem'):
            with self.assertRaises(EnrollmentUnavailable):
                owner.read_owned(Path('.'), name, 100)

    def test_form_contract_rejects_changed_action_and_duplicate_fields(self):
        for page in ('<form method="get"></form>', '<form method="post" action="https://example.invalid"></form>',
                     '<form method="post"><input name="csrf" value="wrong"></form>'):
            with self.assertRaises(EnrollmentUnavailable):
                parser = SetupForm(); parser.feed(page); parser.validate()


@unittest.skipUnless(shutil.which('openssl'), 'OpenSSL is required for ephemeral TLS test certificates')
class ScopedTlsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.cert, key = self.directory/'public.pem', self.directory/'test-only-key.pem'
        configuration = self.directory/'test-openssl.cnf'
        configuration.write_text('[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=extensions\n[dn]\nCN=Test only\n[extensions]\nsubjectAltName=IP:127.0.0.1\n', encoding='ascii')
        subprocess.run([shutil.which('openssl'),'req','-x509','-newkey','rsa:2048','-nodes','-days','1',
                        '-keyout',str(key),'-out',str(self.cert),'-config',str(configuration)],
                       check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        self.submissions = []
        fixture = self
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                page = ('<form method="post"><input type="hidden" name="csrf" value="'+'x'*43+
                        '"><input name="username"><input name="password"><input name="confirm"></form>').encode()
                self.send_response(200);self.send_header('Content-Length',str(len(page)));self.end_headers();self.wfile.write(page)
            def do_POST(self):
                data = self.rfile.read(int(self.headers['Content-Length']))
                fields = parse_qs(data.decode())
                fixture.submissions.append((self.path, set(fields), self.headers.get('Origin')))
                self.send_response(200);self.send_header('Content-Length','0');self.end_headers()
        self.server = http.server.HTTPServer(('127.0.0.1',0),Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(self.cert,key)
        self.server.socket = context.wrap_socket(self.server.socket,server_side=True)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.origin = f'https://127.0.0.1:{self.server.server_port}'
        self.route = self.origin+'/setup/'+'r'*43
        self.owner = Enrollment(metadata(self.origin))
        self.owner.owned_directory = lambda:self.directory
        self.owner.read_owned = lambda directory,name,limit: self.cert.read_bytes() if name=='tls-cert.pem' else self.route.encode()

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()

    def test_real_tls_setup_submission_and_session_binding(self):
        self.owner.prepare('authenticated-test-session')
        with self.assertRaises(EnrollmentUnavailable):
            self.owner.submit('other-session',{'username':'test-owner','password':'test-only-password','confirm':'test-only-password'})
        self.owner.submit('authenticated-test-session',{'username':'test-owner','password':'test-only-password','confirm':'test-only-password'})
        self.assertEqual(self.submissions, [('/setup/'+'r'*43, {'username','password','confirm','csrf'}, self.origin)])
        self.assertEqual(self.owner.pending,{})

    def test_tls_hostname_and_exact_certificate_pin(self):
        context,digest = self.owner.certificate(self.directory)
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
        with self.assertRaises(EnrollmentUnavailable):
            self.owner.request(self.route,context,b'wrong-digest')
        wrong = Enrollment(metadata(f'https://localhost:{self.server.server_port}'))
        with self.assertRaises(ssl.SSLCertVerificationError):
            wrong.request(f'https://localhost:{self.server.server_port}/',context,digest)

    def test_route_replacement_rejected_before_submission(self):
        self.owner.prepare('session')
        self.route = self.origin+'/setup/'+'z'*43
        with self.assertRaises(EnrollmentUnavailable):
            self.owner.submit('session',{'username':'test-owner','password':'test-only-password','confirm':'test-only-password'})
        self.assertEqual(self.submissions,[])


if __name__ == '__main__':
    unittest.main()
