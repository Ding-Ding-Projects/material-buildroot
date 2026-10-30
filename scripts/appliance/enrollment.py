"""Derive narrowly scoped guest enrollment metadata from admitted workload content."""
import re

PROJECT = 'material-appliance'
FORK_ENDPOINTS = {
    'productiveUrl': 'https://127.0.0.1:8443/',
    'healthUrl': 'https://127.0.0.1:8443/healthz',
    'setupOrigin': 'https://127.0.0.1:8444/',
    'setupRequiresPrivateRoute': True,
    'setupRouteSource': {'service': 'initialize', 'path': '/run/owner/setup-access-url'},
    'tunnelSetupAllowed': False,
    'tls': {'mode': 'workload-certificate', 'service': 'initialize', 'volume': 'owner-config',
            'certificatePath': '/run/owner/tls-cert.pem', 'serverName': '127.0.0.1', 'scope': 'workload-only'},
}


def derive_enrollment(prepared, adapter, compose, inventory, productive_url):
    if not prepared or adapter != 'job-2027-fork' or prepared.get('endpoints') != FORK_ENDPOINTS or productive_url != FORK_ENDPOINTS['productiveUrl']:
        return None
    service = (compose or {}).get('services', {}).get('initialize')
    if not isinstance(service, dict) or service.get('image') != prepared.get('image'):
        return None
    logical = (compose or {}).get('volumes', {}).get('owner-config')
    if not isinstance(logical, dict) or logical.get('external'):
        return None
    mounts = []
    for volume in service.get('volumes', []):
        if isinstance(volume, dict):
            if volume.get('target') == '/run/owner':
                mounts.append(volume.get('type') == 'volume' and volume.get('source') == 'owner-config')
        elif isinstance(volume, str) and len(volume.split(':')) >= 2 and volume.split(':')[1] == '/run/owner':
            mounts.append(volume.split(':')[0] == 'owner-config')
    if mounts != [True]:
        return None
    config_id = inventory.get(prepared['image'])
    configuration = inventory.configurations.get(config_id, {})
    revision = configuration.get('config', {}).get('Labels', {}).get('org.opencontainers.image.revision')
    if not isinstance(revision, str) or not re.fullmatch('[a-f0-9]{40}', revision) or revision != prepared.get('sourceRevision') or not isinstance(config_id, str) or not re.fullmatch('sha256:[a-f0-9]{64}', config_id):
        return None
    return {'composeProject': PROJECT, 'service': 'initialize', 'volume': 'owner-config',
            'imageId': config_id, 'sourceRevision': revision, 'productiveUrl': productive_url,
            'setupOrigin': FORK_ENDPOINTS['setupOrigin']}
