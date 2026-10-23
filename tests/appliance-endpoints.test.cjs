"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const endpoints=require('../src/main/appliance/workload-endpoints.json');
test('prepared endpoints preserve source-owned setup and productive ports separately',()=>{
 assert.equal(endpoints['job-2027-fork'].productiveUrl,'https://127.0.0.1:8443/');assert.equal(endpoints['job-2027-fork'].healthUrl,'https://127.0.0.1:8443/healthz');assert.equal(endpoints['job-2027-fork'].setupOrigin,'https://127.0.0.1:8444/');assert.equal(endpoints['job-2027-fork'].setupRequiresPrivateRoute,true);assert.equal(endpoints['home-assistant-material'].productiveUrl,'http://127.0.0.1:8123/');assert.equal(endpoints['job-2027-upstream'].productiveUrl,'http://127.0.0.1:8080/');
});
test('source certificate contract is public-certificate-only and excludes setup tunnelling',()=>{
 const fork=endpoints['job-2027-fork'];assert.equal(fork.tunnelSetupAllowed,false);assert.equal(fork.tls.scope,'workload-only');assert.equal(fork.tls.certificatePath,'/run/owner/tls-cert.pem');assert.equal(fork.tls.volume,'owner-config');assert.equal(fork.tls.serverName,'127.0.0.1');assert.equal(fork.setupRouteSource.service,'initialize');assert.equal(fork.setupOrigin.includes('/setup/'),false);assert.equal(JSON.stringify(endpoints).includes('tls-key'),false);assert.equal(JSON.stringify(endpoints).includes('verify=false'),false);
});
