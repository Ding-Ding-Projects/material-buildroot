"""Fixed source build recipes for already admitted, isolated source snapshots.

This module does not start builds or accept shell fragments. The application worker
executes the returned argument vectors only after source and operation admission.
"""
import json
import os
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
    elif frontend_snapshot is None and frontend_revision == revision:
        recipe = _home_assistant_repository(source, output, operation, revision, receipt)
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


def _build(image, dockerfile='Dockerfile'):
    # BuildKit writes every layer gzip-compressed and adds no attestation, so the saved
    # archive holds only what the ISO producer's identity check and the guest engine read.
    # (Upstream Home Assistant base images are published with zstd layers.)
    return ['docker', 'build', '--platform', 'linux/amd64', '-f', dockerfile, '--provenance=false', '--sbom=false',
            '--output', 'type=image,name=' + image + ',compression=gzip,force-compression=true', '.']


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
            'buildCommands': [_build(api, 'api.Dockerfile'),
                              _build(frontend, 'frontend.Dockerfile'),
                              ['docker', 'pull', '--platform', 'linux/amd64', 'postgres:18-bookworm']],
            'runtimeSetup': {'requiredEnvironment': ['JOB_POSTGRES_PASSWORD'], 'freshDataOnly': True},
            'limitations': ['SCRAPING_WORKER_DISABLED', 'PAID_AI_NOT_CONFIGURED', 'READ_ONLY_API_PREVIEW', 'RUNTIME_NOT_VERIFIED']}


def _copy_regular(source, destination):
    # Copies regular files only. Symbolic links (agent notes in the repository) are
    # left out and listed, so the receipt says what was not copied.
    forbidden = {'.git', '.env', '.hosting', 'node_modules', '__pycache__'}
    skip = lambda name: name in forbidden or name.startswith('.env.') and name != '.env.example'
    omitted = []
    for root, folders, names in os.walk(source):
        here = Path(root)
        for name in list(folders):
            if skip(name) or (here / name).is_symlink():
                folders.remove(name)
                if (here / name).is_symlink():
                    omitted.append(str((here / name).relative_to(source)))
        for name in names:
            path = here / name
            if skip(name):
                continue
            if path.is_symlink():
                omitted.append(str(path.relative_to(source)))
            elif path.is_file():
                target = destination / path.relative_to(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)
    return sorted(omitted)


def _home_assistant_repository(source, output, operation, revision, receipt):
    # Home Assistant Material keeps Core in core/ and its Material frontend in frontend/,
    # with the upstream versions it follows in versions.json.
    _required(source, ['versions.json', 'core/Dockerfile', 'core/pyproject.toml', 'core/requirements.txt',
                       'core/requirements_all.txt', 'core/homeassistant/package_constraints.txt',
                       'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/pyproject.toml',
                       'frontend/gulpfile.js'])
    versions = json.loads((source / 'versions.json').read_text())
    core, base = versions.get('core'), versions.get('core_base_image')
    for value in (core, base):
        if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,3}', value):
            raise ValueError('Core or base image version unavailable in versions.json')
    match = re.search(r'^version\s*=\s*"([0-9.]+)"', (source / 'frontend/pyproject.toml').read_text(), re.M)
    if not match:
        raise ValueError('Frontend package version unavailable')
    omitted = []
    for part in ('core', 'frontend'):
        omitted += [part + '/' + name for name in _copy_regular(source / part, output / part)]
    receipt['frontendRevision'] = revision
    receipt['frontendVersion'] = match[1]
    receipt['coreVersion'] = core
    receipt['layout'] = 'One repository: Core in core/, the frontend in frontend/'
    receipt['mode'] = 'Home Assistant Core container, not Home Assistant OS or Supervisor'
    receipt['downloadedImages'] = ['ghcr.io/home-assistant/amd64-homeassistant-base:' + base,
                                   'ghcr.io/home-assistant/amd64-homeassistant:' + core + ' (integration translations only)']
    if omitted:
        receipt['snapshotAdjustments'].append({'reason': 'Symbolic links are not copied into the build', 'files': omitted})
    image = 'material-buildroot/home-assistant:' + operation
    # The same stages as the repository's own build: the frontend wheel (build/frontend.Dockerfile),
    # the integration translations of the matching upstream release (build/translations.Dockerfile),
    # then core/Dockerfile reading from the assembled tree.
    _write(output, 'Dockerfile', f'''FROM node:24.22.1-bookworm AS frontend
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv git && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /src
COPY frontend/ .
ENV HUSKY=0 CI=1 NODE_OPTIONS=--max_old_space_size=6144 SKIP_FETCH_NIGHTLY_TRANSLATIONS=1 HA_BUILD_WORKERS=4
RUN pnpm install --frozen-lockfile
RUN ./node_modules/.bin/gulp build-app || HA_BUILD_WORKERS=2 ./node_modules/.bin/gulp build-app
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir build && rm -rf dist home_assistant_frontend.egg-info && /venv/bin/python -m build -q --wheel
FROM ghcr.io/home-assistant/amd64-homeassistant:{core} AS translations
RUN mkdir /out && cd /usr/src/homeassistant/homeassistant && find components -path '*/translations/*.json' | tar cf - -T - | tar xf - -C /out
FROM scratch AS source
COPY core/ /
COPY --from=frontend /src/dist/ /
COPY --from=translations /out/ /homeassistant/
FROM ghcr.io/home-assistant/amd64-homeassistant-base:{base}
LABEL io.hass.type="core" io.hass.arch="amd64" io.hass.version="{core}" org.opencontainers.image.title="Home Assistant Material" org.opencontainers.image.revision="{revision}" org.material-buildroot.frontend-revision="{revision}" org.opencontainers.image.licenses="Apache-2.0"
ENV S6_SERVICES_GRACETIME=240000 UV_SYSTEM_PYTHON=true UV_NO_CACHE=true
WORKDIR /usr/src
COPY --from=source /rootfs/ /
RUN echo "source;{revision};material-buildroot;appliance" > /OFFICIAL_IMAGE
COPY --from=ghcr.io/alexxit/go2rtc:1.9.15@sha256:e098de5c2f8040dc3d4784ed2d5cfdac3b0979f9349afe587ef6a670a14b9f4d /usr/local/bin/go2rtc /bin/go2rtc
COPY --from=source /requirements.txt homeassistant/
COPY --from=source /homeassistant/package_constraints.txt homeassistant/homeassistant/
RUN go2rtc --version && pip3 install --no-cache-dir "uv==$(awk -F'==' '/^uv==/{{print $2}}' homeassistant/requirements.txt)" && uv pip install --no-build -r homeassistant/requirements.txt
COPY --from=source /requirements_all.txt /home_assistant_frontend-*.whl homeassistant/
RUN uv pip install homeassistant/home_assistant_frontend-*.whl && uv pip install --no-build -r homeassistant/requirements_all.txt
COPY --from=source /LICENSE.md /README.rst /pyproject.toml homeassistant/
COPY --from=source /homeassistant/ homeassistant/homeassistant/
RUN uv pip install -e ./homeassistant && python3 -m compileall -q homeassistant/homeassistant && python3 -c "import importlib.metadata as m; assert m.version('home-assistant-frontend') == '{match[1]}'"
WORKDIR /config
''')
    # The same check as the repository's compose.yaml, so a console appliance can report readiness.
    health = {'test': ['CMD', 'curl', '--fail', '--silent', '--max-time', '5', 'http://127.0.0.1:8123/manifest.json'],
              'interval': '10s', 'timeout': '10s', 'retries': 6, 'start_period': '120s'}
    return {'images': [image], 'buildCommands': [_build(image)],
            'compose': {'services': {'homeassistant': {'image': image, 'network_mode': 'host',
                'volumes': ['homeassistant-config:/config'], 'restart': 'unless-stopped', 'healthcheck': health}},
                'volumes': {'homeassistant-config': {}}},
            'limitations': ['NO_SUPERVISOR_OR_HAOS', 'NO_IMPLICIT_PRIVILEGED_OR_USB_ACCESS',
                            'UPSTREAM_BASE_AND_TRANSLATION_IMAGES_DOWNLOADED']}


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
    return {'images': [image], 'buildCommands': [_build(image)],
            'compose': {'services': {'homeassistant': {'image': image, 'network_mode': 'host',
                'volumes': ['homeassistant-config:/config'], 'restart': 'unless-stopped'}},
                'volumes': {'homeassistant-config': {}}},
            'limitations': ['NO_SUPERVISOR_OR_HAOS', 'NO_IMPLICIT_PRIVILEGED_OR_USB_ACCESS',
                            'CUSTOM_FRONTEND_RUNTIME_COMPATIBILITY_REQUIRES_VERIFICATION']}
