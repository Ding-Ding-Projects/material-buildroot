"""Fixed remote build protocol. All caller data arrives on standard input."""
import base64, hashlib, io, json, os, pathlib, re, shutil, signal, stat, subprocess, sys, time, uuid, zipfile
LIMIT = 32 * 1024 * 1024

def fail(code):
    raise ValueError(code)

def safe_root(value):
    p = pathlib.Path(value)
    if not p.is_absolute() or str(p.resolve()) != str(p) or not p.is_dir(): fail('REMOTE_ROOT_UNSAFE')
    for entry in [p, *p.parents]:
        if entry.is_symlink(): fail('REMOTE_ROOT_UNSAFE')
    return p

def atomic(file, value):
    temporary = file.with_name(file.name + '.' + str(uuid.uuid4()))
    with temporary.open('x', encoding='utf-8') as out: json.dump(value, out)
    os.replace(temporary, file)

def identity(root):
    s = root.stat()
    return str(s.st_dev) + ':' + str(s.st_ino)

def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as inp:
        for data in iter(lambda: inp.read(1024 * 1024), b''): h.update(data)
    return h.hexdigest()

def regular(file):
    s = file.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or file.is_symlink(): fail('REMOTE_FILE_UNSAFE')
    return s

def read(file):
    if regular(file).st_size > LIMIT: fail('REMOTE_RECORD_LIMIT')
    return json.loads(file.read_text(encoding='utf-8'))

def uuid_path(root, category, value):
    if str(uuid.UUID(value)) != value: fail('REMOTE_ID_INVALID')
    parent = root / category
    if not parent.exists(): parent.mkdir(mode=0o700)
    if parent.is_symlink() or parent.resolve() != parent: fail('REMOTE_PATH_UNSAFE')
    return parent / value

def inventory(source):
    values = []
    for folder, dirs, files in os.walk(source, followlinks=False):
        for name in dirs:
            if (pathlib.Path(folder) / name).is_symlink(): fail('REMOTE_SOURCE_LINK')
        for name in sorted(files):
            file = pathlib.Path(folder) / name
            s = regular(file)
            values.append([file.relative_to(source).as_posix(), s.st_size, digest(file)])
            if len(values) > 100000: fail('REMOTE_SOURCE_LIMIT')
    return hashlib.sha256(json.dumps(sorted(values), separators=(',', ':')).encode()).hexdigest()

def worker(file):
    row = read(file)
    root = safe_root(row['root'])
    if identity(root) != row['rootIdentity']: fail('REMOTE_IDENTITY_CHANGED')
    folder = file.parent
    source = uuid_path(root, 'transfers', row['transferId']) / 'source'
    if inventory(source) != row['sourceDigest']: fail('REMOTE_SOURCE_CHANGED')
    private_source = folder / 'source'
    shutil.copytree(source, private_source)
    source = private_source
    if inventory(source) != row['sourceDigest']: fail('REMOTE_SOURCE_CHANGED')
    out = folder / 'output'
    out.mkdir(mode=0o700)
    config = source / '.config'
    regular(config)
    shutil.copyfile(config, out / '.config')
    if row['kind'].endswith('docker'):
        name = 'material-buildroot-' + row['id']
        command = ['docker', 'run', '--pull=never', '--rm', '--name', name, '--label', 'io.material-buildroot.job=' + row['id'], '--user', str(row['uid']) + ':' + str(row['gid']), '--cap-drop=ALL', '--security-opt=no-new-privileges', '--mount', 'type=bind,source=' + str(source) + ',target=/source,readonly', '--mount', 'type=bind,source=' + str(out) + ',target=/output', '--workdir', '/source', row['image'], 'make', 'O=/output', '-j' + str(row['parallelism']), row['target']]
    else:
        if os.name == 'nt' or os.getuid() == 0: fail('REMOTE_NONROOT_REQUIRED')
        command = ['make', '-C', str(source), 'O=' + str(out), '-j' + str(row['parallelism']), row['target']]
    row['state'] = 'running'; row['updatedAt'] = time.time(); atomic(file, row)
    # Logs remain on the target and are never reflected into credentials or the local UI.
    with (folder / 'build.log').open('xb') as log:
        child = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=os.name != 'nt', creationflags=0x08000000 if os.name == 'nt' else 0)
        cancelled = False
        while child.poll() is None:
            row['updatedAt'] = time.time(); atomic(file, row)
            if (folder / 'cancel').exists():
                cancelled = True
                if row['kind'].endswith('docker'):
                    proof = subprocess.run(['docker', 'inspect', '--format', '{{index .Config.Labels "io.material-buildroot.job"}}', name], capture_output=True, timeout=15)
                    if proof.returncode != 0 or proof.stdout.decode().strip() != row['id']: fail('REMOTE_CANCELLATION_UNKNOWN')
                    subprocess.run(['docker', 'stop', '--time', '10', name], capture_output=True, timeout=30, check=True)
                elif os.name != 'nt': os.killpg(child.pid, signal.SIGTERM)
                else: fail('REMOTE_CANCELLATION_UNAVAILABLE')
                try: child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    if os.name != 'nt': os.killpg(child.pid, signal.SIGKILL)
                    else: fail('REMOTE_CANCELLATION_UNKNOWN')
                break
            time.sleep(1)
        code = child.wait(timeout=20)
    row['state'] = 'cancelled' if cancelled else ('succeeded' if code == 0 else 'failed')
    row['exitCode'] = code; row['updatedAt'] = time.time(); atomic(file, row)

def protocol(q):
    root = safe_root(q['root'])
    if q['kind'] != 'windows-docker' and (os.name == 'nt' or os.getuid() == 0): fail('REMOTE_NONROOT_REQUIRED')
    if q['kind'] == 'windows-docker' and os.name != 'nt': fail('REMOTE_PLATFORM_MISMATCH')
    key = identity(root)
    if q['action'] == 'inspect':
        return {'state': 'enrolled', 'rootIdentity': key, 'protocol': 1, 'kind': q['kind']}
    if q['rootIdentity'] != key: fail('REMOTE_IDENTITY_CHANGED')
    if q['action'] == 'transfer':
        folder = uuid_path(root, 'transfers', q['id']); folder.mkdir(mode=0o700)
        atomic(folder / 'receipt.json', {'state': 'incomplete', 'sha256': q['sha256']})
        raw = base64.b64decode(q['archive'], validate=True)
        if len(raw) > LIMIT or hashlib.sha256(raw).hexdigest() != q['sha256']: fail('REMOTE_TRANSFER_DIGEST')
        source = folder / 'source'; source.mkdir(mode=0o700)
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            members = archive.infolist()
            if len(members) > 100000 or sum(x.file_size for x in members) > 1024 ** 3: fail('REMOTE_EXPANSION_LIMIT')
            seen = set()
            for item in members:
                name = item.filename.rstrip('/')
                parts = pathlib.PurePosixPath(name).parts
                if not parts or name.startswith('/') or '\\' in name or any(p in ('', '.', '..') or ':' in p or p.endswith(('.', ' ')) or re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', p, re.I) for p in parts): fail('REMOTE_ARCHIVE_PATH')
                if name.casefold() in seen: fail('REMOTE_ARCHIVE_DUPLICATE')
                seen.add(name.casefold())
                mode = item.external_attr >> 16
                if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR): fail('REMOTE_ARCHIVE_LINK')
                destination = source.joinpath(*parts)
                if item.is_dir(): destination.mkdir(parents=True, exist_ok=True)
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(item) as inp, destination.open('xb') as out:
                        remaining = item.file_size
                        while remaining:
                            chunk = inp.read(min(1024 * 1024, remaining))
                            if not chunk: fail('REMOTE_ARCHIVE_TRUNCATED')
                            out.write(chunk); remaining -= len(chunk)
                    destination.chmod(0o755 if mode & 0o111 else 0o644)
        if not (source / 'Makefile').is_file() or not (source / 'Config.in').is_file(): fail('REMOTE_BUILDROOT_REQUIRED')
        result = {'state': 'transferred', 'id': q['id'], 'sha256': q['sha256'], 'sourceDigest': inventory(source)}
        atomic(folder / 'receipt.json', result); return result
    folder = uuid_path(root, 'jobs', q['id']); record = folder / 'job.json'
    if q['action'] == 'start':
        transfer = read(uuid_path(root, 'transfers', q['transferId']) / 'receipt.json')
        if transfer['state'] != 'transferred' or transfer['sourceDigest'] != q['sourceDigest']: fail('REMOTE_SOURCE_MISMATCH')
        folder.mkdir(mode=0o700)
        row = {k: q[k] for k in ('id', 'root', 'rootIdentity', 'kind', 'transferId', 'sourceDigest', 'target', 'parallelism', 'uid', 'gid', 'image')}
        row['state'] = 'dispatch-unconfirmed'; row['updatedAt'] = time.time(); atomic(record, row)
        script = base64.b64decode(q['worker'], validate=True).decode('utf-8')
        # The worker is shipped by the host application, never supplied by the renderer.
        subprocess.Popen([sys.executable, '-I', '-c', script, '--worker', str(record)], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=os.name != 'nt', creationflags=(0x00000008 | 0x08000000) if os.name == 'nt' else 0)
        return {'id': q['id'], 'state': 'dispatch-unconfirmed'}
    row = read(record)
    for name in ('kind', 'rootIdentity', 'sourceDigest', 'transferId'):
        if row[name] != q[name]: fail('REMOTE_JOB_BINDING_MISMATCH')
    if q['action'] == 'cancel':
        if row['state'] in ('succeeded', 'failed', 'cancelled'): return {'id': q['id'], 'state': row['state']}
        (folder / 'cancel').touch(exist_ok=True)
        return {'id': q['id'], 'state': 'cancel-requested'}
    if q['action'] == 'observe':
        state = row['state']
        if state in ('running', 'dispatch-unconfirmed') and time.time() - row['updatedAt'] > 60: state = 'unknown'
        return {'id': q['id'], 'state': state, 'exitCode': row.get('exitCode'), 'sourceDigest': row['sourceDigest']}
    if q['action'] == 'outputs':
        if row['state'] != 'succeeded': fail('REMOTE_OUTPUT_NOT_READY')
        image_root = folder / 'output' / 'images'
        if image_root.is_symlink() or image_root.resolve() != image_root: fail('REMOTE_OUTPUT_UNSAFE')
        values = []
        for item in image_root.iterdir():
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]{0,199}', item.name): continue
            if item.is_symlink() or not item.is_file(): continue
            s = regular(item)
            values.append({'name': item.name, 'bytes': s.st_size, 'sha256': digest(item)})
            if len(values) > 1000: fail('REMOTE_OUTPUT_LIMIT')
        return {'files': values, 'sourceDigest': row['sourceDigest']}
    if q['action'] == 'download':
        if row['state'] != 'succeeded' or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]{0,199}', q['name']): fail('REMOTE_OUTPUT_NOT_READY')
        file = folder / 'output' / 'images' / q['name']
        if file.resolve() != file or regular(file).st_size > LIMIT: fail('REMOTE_DOWNLOAD_LIMIT')
        raw = file.read_bytes()
        actual = hashlib.sha256(raw).hexdigest()
        if actual != q['sha256']: fail('REMOTE_OUTPUT_CHANGED')
        return {'archive': base64.b64encode(raw).decode(), 'sha256': actual, 'bytes': len(raw)}
    fail('REMOTE_ACTION_INVALID')

try:
    if len(sys.argv) == 3 and sys.argv[1] == '--worker': worker(pathlib.Path(sys.argv[2]))
    else:
        request = sys.stdin.buffer.read(48 * 1024 * 1024 + 1)
        if len(request) > 48 * 1024 * 1024: fail('REMOTE_INPUT_LIMIT')
        print(json.dumps(protocol(json.loads(request))))
except Exception:
    # Never reflect remote exception text, paths, environment or credential material.
    print(json.dumps({'state': 'unknown', 'code': 'REMOTE_OPERATION_INCOMPLETE'}))
    sys.exit(1)


