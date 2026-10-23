"""Fixed source build recipes for already admitted, isolated source snapshots.

This module does not start builds or accept shell fragments. The application worker
executes the returned argument vectors only after source and operation admission.
"""
import json
from pathlib import Path
import re
import shutil


def _required(root, names):
    for name in names:
        path = root / name
        if not path.is_file() or path.is_symlink():
            raise ValueError('Required tracked source input unavailable: ' + name)


def _write(root, name, content):
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def materialize(adapter, snapshot, output, operation, revision,
                frontend_snapshot=None, frontend_revision=None):
    """Create a fixed recipe. Inputs must be fresh git-archive snapshots, not checkouts."""
    if not re.fullmatch(r'[a-f0-9-]{36}', operation) or not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise ValueError('Invalid operation or source revision')
    source, output = Path(snapshot), Path(output)
    if not source.is_absolute() or not output.is_absolute() or source.is_symlink() or output.is_symlink():
        raise ValueError('Absolute isolated snapshot paths required')
    if output.exists():
        raise ValueError('Recipe output must be new')
    if source == output or source in output.parents or output in source.parents:
        raise ValueError('Recipe output and source must be separate')
    if adapter not in ('job-2027-upstream', 'home-assistant-material'):
        raise ValueError('Unsupported source adapter')
    output.mkdir(parents=True, mode=0o700)
    receipt = {'schemaVersion': 1, 'adapter': adapter, 'sourceRevision': revision,
               'runtimeVerified': False, 'sourceModified': False, 'snapshotAdjustments': []}
    if adapter == 'job-2027-upstream':
        recipe = _job(source, output, operation, revision, receipt)
    else:
        if not re.fullmatch(r'[a-f0-9]{40}', frontend_revision or ''):
            raise ValueError('Custom frontend revision is required')
        recipe = _home_assistant(source, Path(frontend_snapshot), output, operation,
                                 revision, frontend_revision, receipt)
    _write(output, 'source-receipt.json', json.dumps(receipt, indent=2) + '\n')
    # This documented entrypoint is synthesized only in the isolated build bundle.
    _write(output, 'build.bat', '#!/usr/bin/env bash\nset -euo pipefail\ncd "$(dirname "$0")"\nexec python3 build-adapter.py\n')
    build_script = '''import json, subprocess
from pathlib import Path
plan = json.loads(Path('build-plan.json').read_text())
for command in plan['buildCommands']:
    subprocess.run(command, check=True)
'''
    _write(output, 'build-adapter.py', build_script)
    recipe['entrypoint'] = ['bash', 'build.bat']
    recipe['receipt'] = receipt
    _write(output, 'build-plan.json', json.dumps(recipe, indent=2) + '\n')
    _write(output, 'compose.json', json.dumps(recipe['compose'], indent=2) + '\n')
    return recipe


def _copy(source, destination):
    # No source symlink, credential file, VCS metadata or pre-existing data is copied.
    forbidden = {'.git', '.env', '.hosting', 'node_modules', '__pycache__'}
    def ignore(root, names):
        return [name for name in names if name in forbidden or name.startswith('.env.') and name != '.env.example']
    for path in source.rglob('*'):
        if path.is_symlink():
            raise ValueError('Source symlinks are unsupported')
    shutil.copytree(source, destination, ignore=ignore)


def _job(source, output, operation, revision, receipt):
    _required(source, ['backend/pyproject.toml', 'backend/src/job_backend/main.py',
                       'frontend/package.json', 'frontend/package-lock.json'])
    _copy(source, output / 'source')
    settings = output / 'source/frontend/src/app/settings/connection-settings.ts'
    if not settings.is_file() or "'http://127.0.0.1:8000'" not in settings.read_text():
        raise ValueError('Supported frontend backend-address contract unavailable')
    _write(output / 'source', 'frontend/src/app/settings/connection-settings.ts',
           settings.read_text().replace("'http://127.0.0.1:8000'", 'window.location.origin'))
    receipt['snapshotAdjustments'].append({'files': ['frontend/src/app/settings/connection-settings.ts'],
        'reason': 'Use the appliance same-origin API proxy rather than the visitor loopback address'})
    api = 'material-buildroot/job-api:' + operation
    frontend = 'material-buildroot/job-frontend:' + operation
    _write(output, 'api.Dockerfile', f'''FROM python:3.12-slim-bookworm
LABEL org.opencontainers.image.revision="{revision}"
WORKDIR /app
COPY source/backend/ /app/
RUN pip install --no-cache-dir . && useradd --uid 10001 --create-home workload && mkdir /data && chown workload /data
ENV JOB_DATA_DIR=/data
USER workload
ENTRYPOINT ["python", "-m", "uvicorn", "job_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
''')
    _write(output, 'frontend.Dockerfile', f'''FROM node:24.19.0-bookworm AS frontend
WORKDIR /source
COPY source/ /source/
WORKDIR /source/frontend
RUN npm ci --ignore-scripts && npm run build
FROM nginx:1.28-bookworm
LABEL org.opencontainers.image.revision="{revision}"
COPY --from=frontend /source/frontend/dist/frontend/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
''')
    _write(output, 'nginx.conf', '''server {
  listen 8080;
  root /usr/share/nginx/html;
  location ~ ^/(health|connection|databases|activity|jobs|profile|resumes|scrapes)(/|$) {
    if ($request_method !~ ^(GET|HEAD|OPTIONS)$) { return 403; }
    proxy_pass http://api:8000;
    proxy_set_header Host $host;
  }
  location / { try_files $uri $uri/ /index.html; }
}
''')
    # A random installation credential is generated on first boot, never baked here.
    compose = {'services': {
        'postgres': {'image': 'postgres:18-bookworm', 'environment': {
            'POSTGRES_DB': 'job_2027', 'POSTGRES_USER': 'job_2027',
            'POSTGRES_PASSWORD': '${JOB_POSTGRES_PASSWORD:?Fresh installation password required}'},
            'volumes': ['postgres-data:/var/lib/postgresql'],
            'networks': ['backend'],
            'healthcheck': {'test': ['CMD-SHELL', 'pg_isready -U job_2027 -d job_2027'],
                            'interval': '5s', 'timeout': '5s', 'retries': 24}},
        'api': {'image': api, 'environment': {'JOB_DATA_DIR': '/data',
            'JOB_DATABASE_URL': 'postgresql://job_2027:${JOB_POSTGRES_PASSWORD:?Fresh installation password required}@postgres:5432/job_2027'},
            'networks': ['backend'], 'volumes': ['job-data:/data'], 'depends_on': {'postgres': {'condition': 'service_healthy'}}},
        'frontend': {'image': frontend, 'ports': ['8080:8080'], 'networks': ['backend', 'web'], 'depends_on': ['api']}},
        'networks': {'backend': {'internal': True}, 'web': {}},
        'volumes': {'postgres-data': {}, 'job-data': {}}}
    receipt['safety'] = {'workerIncluded': False, 'scrapingStarted': False,
                         'paidAiConfigured': False, 'existingEnvironmentImported': False,
                         'existingDataImported': False}
    return {'images': [api, frontend, 'postgres:18-bookworm'], 'compose': compose,
            'buildCommands': [['docker', 'build', '--platform', 'linux/amd64', '-f', 'api.Dockerfile', '-t', api, '.'],
                              ['docker', 'build', '--platform', 'linux/amd64', '-f', 'frontend.Dockerfile', '-t', frontend, '.'],
                              ['docker', 'pull', '--platform', 'linux/amd64', 'postgres:18-bookworm']],
            'runtimeSetup': {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True},
            'limitations': ['SCRAPING_WORKER_DISABLED', 'PAID_AI_NOT_CONFIGURED', 'READ_ONLY_API_PREVIEW', 'RUNTIME_NOT_VERIFIED']}


def _home_assistant(source, frontend, output, operation, revision, frontend_revision, receipt):
    if not frontend.is_absolute() or frontend.is_symlink():
        raise ValueError('Absolute isolated frontend snapshot required')
    _required(source, ['pyproject.toml', 'requirements.txt', 'homeassistant/components/frontend/manifest.json',
                       'homeassistant/package_constraints.txt'])
    _required(frontend, ['pyproject.toml', 'yarn.lock', 'script/build_frontend', '.yarn/releases/yarn-4.18.0.cjs'])
    _copy(source, output / 'core')
    _copy(frontend, output / 'frontend')
    text = (frontend / 'pyproject.toml').read_text()
    match = re.search(r'^version\s*=\s*"([0-9.]+)"', text, re.M)
    if not match:
        raise ValueError('Frontend package version unavailable')
    version = match[1]
    manifest = json.loads((source / 'homeassistant/components/frontend/manifest.json').read_text())
    pins = [value for value in manifest['requirements'] if value.startswith('home-assistant-frontend==')]
    if len(pins) != 1:
        raise ValueError('Exact Core frontend requirement unavailable')
    original = pins[0]
    replacement = 'home-assistant-frontend==' + version
    if original != replacement:
        changed = []
        for relative in ['homeassistant/components/frontend/manifest.json', 'homeassistant/package_constraints.txt',
                         'requirements.txt', 'requirements_all.txt']:
            file = output / 'core' / relative
            if not file.exists():
                continue
            content = file.read_text()
            if original in content:
                _write(output / 'core', relative, content.replace(original, replacement))
                changed.append(relative)
        receipt['snapshotAdjustments'].append({'reason': 'Use the actual custom frontend wheel without relabelling its version',
            'originalRequirement': original, 'effectiveRequirement': replacement, 'files': changed,
            'runtimeCompatibility': 'unverified'})
    receipt['frontendRevision'] = frontend_revision
    receipt['frontendVersion'] = version
    receipt['mode'] = 'Home Assistant Core container, not Home Assistant OS or Supervisor'
    image = 'material-buildroot/home-assistant:' + operation
    _write(output, 'Dockerfile', f'''FROM node:24.19.0-bookworm AS frontend
WORKDIR /frontend
COPY frontend/ /frontend/
RUN node .yarn/releases/yarn-4.18.0.cjs install --immutable && sh script/build_frontend
FROM python:3.14.2-bookworm AS wheel
WORKDIR /frontend
COPY --from=frontend /frontend/ /frontend/
RUN pip wheel --no-deps --wheel-dir /wheels .
FROM python:3.14.2-bookworm
LABEL org.opencontainers.image.revision="{revision}" org.material-buildroot.frontend-revision="{frontend_revision}"
WORKDIR /usr/src/homeassistant
COPY core/ /usr/src/homeassistant/
COPY --from=wheel /wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl && pip install --no-cache-dir -r requirements.txt . && pip check && python -c "import hass_frontend; import homeassistant; from importlib.metadata import version; assert version('home-assistant-frontend') == '{version}'"
WORKDIR /config
ENTRYPOINT ["python", "-m", "homeassistant", "--config", "/config"]
''')
    return {'images': [image], 'buildCommands': [['docker', 'build', '--platform', 'linux/amd64', '-t', image, '.']],
            'compose': {'services': {'homeassistant': {'image': image, 'network_mode': 'host',
                'volumes': ['homeassistant-config:/config'], 'restart': 'unless-stopped'}},
                'volumes': {'homeassistant-config': {}}},
            'limitations': ['NO_SUPERVISOR_OR_HAOS', 'NO_IMPLICIT_PRIVILEGED_OR_USB_ACCESS',
                            'CUSTOM_FRONTEND_RUNTIME_COMPATIBILITY_REQUIRES_VERIFICATION']}
