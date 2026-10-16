"""Fixed remote build protocol. All caller data arrives on standard input."""
import base64, hashlib, io, json, os, pathlib, re, shutil, signal, stat, subprocess, sys, time, uuid, zipfile
LIMIT = 1107296256
CHUNK = 1024 * 1024

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
    if regular(file).st_size > 1024 * 1024: fail('REMOTE_RECORD_LIMIT')
    return json.loads(file.read_text(encoding='utf-8'))

def uuid_path(root, category, value):
    if str(uuid.UUID(value)) != value: fail('REMOTE_ID_INVALID')
    parent = root / category
    if not parent.exists(): parent.mkdir(mode=0o700)
    if parent.is_symlink() or parent.resolve() != parent: fail('REMOTE_PATH_UNSAFE')
    child = parent / value
    if child.exists() and (child.is_symlink() or child.resolve() != child or not child.is_dir()): fail('REMOTE_PATH_UNSAFE')
    return child

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
        command = ['docker', 'run', '--pull=never', '--rm', '--name', name, '--label', 'io.material-buildroot.job=' + row['id'], '--user', str(row['uid']) + ':' + str(row['gid']), '--cpus', str(row['parallelism']), '--memory', '4294967296', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--mount', 'type=bind,source=' + str(source) + ',target=/source,readonly', '--mount', 'type=bind,source=' + str(out) + ',target=/output', '--workdir', '/source', row['image'], 'make', 'O=/output', '-j' + str(row['parallelism']), row['target']]
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
    if q['action'] == 'resources':
        if q['rootIdentity'] != key: fail('REMOTE_IDENTITY_CHANGED')
        if os.name == 'nt':
            import ctypes
            class Memory(ctypes.Structure):
                _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(n, ctypes.c_ulonglong) for n in ('total', 'available', 'page_total', 'page_available', 'virtual_total', 'virtual_available', 'extended')]
            memory = Memory(); memory.length = ctypes.sizeof(memory)
            if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)): fail('REMOTE_RESOURCE_UNKNOWN')
            available = memory.available
        else: available = os.sysconf('SC_AVPHYS_PAGES') * os.sysconf('SC_PAGE_SIZE')
        return {'cpuSlots': os.cpu_count(), 'memoryAvailableBytes': available, 'storageAvailableBytes': shutil.disk_usage(root).free}
    if q['action'] == 'inspect':
        return {'state': 'enrolled', 'rootIdentity': key, 'protocol': 1, 'kind': q['kind']}
    if q['rootIdentity'] != key: fail('REMOTE_IDENTITY_CHANGED')
    if q['action'] in ('transfer-begin', 'transfer-chunk', 'transfer-finish'):
        folder = uuid_path(root, 'transfers', q['id'])
        archive_file = folder / 'source.zip'
        receipt_file = folder / 'receipt.json'
        if q['action'] == 'transfer-begin':
            if not isinstance(q['bytes'], int) or not 0 < q['bytes'] <= LIMIT or not re.fullmatch('[a-f0-9]{64}', q['sha256']): fail('REMOTE_TRANSFER_LIMIT')
            folder.mkdir(mode=0o700)
            with archive_file.open('xb'): pass
            atomic(receipt_file, {'state': 'incomplete', 'sha256': q['sha256'], 'bytes': q['bytes'], 'offset': 0})
            return {'id': q['id'], 'offset': 0}
        receipt = read(receipt_file)
        if receipt['state'] != 'incomplete' or receipt['sha256'] != q['sha256']: fail('REMOTE_TRANSFER_BINDING')
        if q['action'] == 'transfer-chunk':
            raw = base64.b64decode(q['chunk'], validate=True)
            if not 0 < len(raw) <= CHUNK or q['offset'] != receipt['offset'] or q['offset'] + len(raw) > receipt['bytes'] or regular(archive_file).st_size != q['offset']: fail('REMOTE_TRANSFER_SEQUENCE')
            with archive_file.open('ab') as out: out.write(raw); out.flush(); os.fsync(out.fileno())
            receipt['offset'] += len(raw); atomic(receipt_file, receipt)
            return {'id': q['id'], 'offset': receipt['offset']}
        if receipt['offset'] != receipt['bytes'] or regular(archive_file).st_size != receipt['bytes'] or digest(archive_file) != receipt['sha256']: fail('REMOTE_TRANSFER_DIGEST')
        source = folder / 'source'; source.mkdir(mode=0o700)
        with zipfile.ZipFile(archive_file) as archive:
            members = archive.infolist()
            if len(members) > 100000 or sum(x.file_size for x in members) > LIMIT: fail('REMOTE_EXPANSION_LIMIT')
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
    if q['action'] == 'logs':
        file = folder / 'build.log'
        info = regular(file)
        log_identity = str(info.st_dev) + ':' + str(info.st_ino)
        if not isinstance(q['offset'], int) or q['offset'] < 0 or q['offset'] > min(info.st_size, 1024 * 1024): fail('REMOTE_LOG_SEQUENCE')
        if q['offset'] and q['logIdentity'] != log_identity: fail('REMOTE_LOG_IDENTITY')
        with file.open('rb') as inp:
            inp.seek(q['offset']); raw = inp.read(min(65536, 1024 * 1024 - q['offset']))
        return {'id': q['id'], 'offset': q['offset'], 'next': q['offset'] + len(raw), 'logIdentity': log_identity, 'chunk': base64.b64encode(raw).decode(), 'truncated': info.st_size > 1024 * 1024}
    if q['action'] == 'download-chunk':
        if row['state'] != 'succeeded' or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]{0,199}', q['name']): fail('REMOTE_OUTPUT_NOT_READY')
        file = folder / 'output' / 'images' / q['name']
        info = regular(file)
        if file.resolve() != file or info.st_size > LIMIT: fail('REMOTE_DOWNLOAD_LIMIT')
        file_identity = ':'.join(str(x) for x in (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns))
        if not isinstance(q['offset'], int) or not 0 <= q['offset'] <= info.st_size: fail('REMOTE_DOWNLOAD_SEQUENCE')
        if q['offset'] == 0:
            if digest(file) != q['sha256']: fail('REMOTE_OUTPUT_CHANGED')
        elif q['fileIdentity'] != file_identity: fail('REMOTE_OUTPUT_CHANGED')
        with file.open('rb') as inp:
            inp.seek(q['offset']); raw = inp.read(CHUNK)
        after = regular(file)
        if file_identity != ':'.join(str(x) for x in (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)): fail('REMOTE_OUTPUT_CHANGED')
        return {'offset': q['offset'], 'next': q['offset'] + len(raw), 'fileIdentity': file_identity, 'bytes': info.st_size, 'chunk': base64.b64encode(raw).decode()}
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






