"""Fixed native content inspection. Only aggregate receipts leave the process."""
import hashlib
import json
import os
import signal
import stat
import sys
import time

LIMITS = dict(maxEntries=50000, maxBytes=512 * 1024 * 1024,
              maxFileBytes=64 * 1024 * 1024, maxMs=10000, maxDepth=64)
CACHE_FILE_LIMIT = 256 * 1024 * 1024


class Blocked(Exception):
    pass


def capture(request):
    if os.getuid() == 0:
        raise Blocked("BLOCKED_CONTENT_AUTHORITY")
    limits = dict(LIMITS)
    for key, value in request.get("limits", {}).items():
        if key not in LIMITS or type(value) is not int or not 1 <= value <= LIMITS[key]:
            raise Blocked("BLOCKED_CONTENT_LIMIT")
        limits[key] = value
    source, output = request["source"], request["output"]
    roots = [source] + request.get("externalTrees", [])
    if len(roots) > 33:
        raise Blocked("BLOCKED_CONTENT_LIMIT")
    started = time.monotonic()
    evidence = {}
    absent = set()
    links = []
    content, configuration, cache_hash = (hashlib.sha256() for _ in range(3))
    counts = dict(entries=0, bytes=0, symlinks=0, cacheEntries=0, cacheBytes=0)

    def check():
        if (time.monotonic() - started) * 1000 > limits["maxMs"] or counts["entries"] > limits["maxEntries"] or counts["bytes"] > limits["maxBytes"]:
            raise Blocked("BLOCKED_CONTENT_LIMIT")

    def fingerprint(info):
        return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink,
                info.st_size, info.st_mtime_ns, info.st_ctime_ns)

    def remember(file):
        check()
        info = os.lstat(file)
        if stat.S_ISREG(info.st_mode) and info.st_nlink != 1:
            raise Blocked("BLOCKED_CONTENT_UNSAFE")
        evidence[file] = fingerprint(info)
        return info

    def update(sink, value):
        sink.update((json.dumps(value, ensure_ascii=True, separators=(",", ":")) + "\n").encode())

    for root in roots + [output]:
        if not isinstance(root, str) or not os.path.isabs(root) or os.path.normpath(root) != root or os.path.realpath(root) != root:
            raise Blocked("BLOCKED_PATH_CHANGED")
        info = remember(root)
        if not stat.S_ISDIR(info.st_mode):
            raise Blocked("BLOCKED_PATH_CHANGED")
    # Output directory contents may change independently. Bind its identity,
    # not unrelated output entries or the directory modification timestamp.
    output_identity = (os.lstat(output).st_dev, os.lstat(output).st_ino)
    if output not in roots:
        evidence.pop(output, None)

    def read_file(file, info, sink, cached=False):
        ceiling = CACHE_FILE_LIMIT if cached else limits["maxFileBytes"]
        if info.st_size > ceiling:
            raise Blocked("BLOCKED_CONTENT_LIMIT")
        counts["bytes"] += info.st_size
        if cached:
            counts["cacheBytes"] += info.st_size
        check()
        fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            if fingerprint(os.fstat(fd)) != fingerprint(info):
                raise Blocked("BLOCKED_CONTENT_CHANGED")
            digest = hashlib.sha256()
            total = 0
            while True:
                check()
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                total += len(chunk)
                if total > info.st_size:
                    raise Blocked("BLOCKED_CONTENT_CHANGED")
                digest.update(chunk)
            if total != info.st_size or fingerprint(os.fstat(fd)) != fingerprint(info):
                raise Blocked("BLOCKED_CONTENT_CHANGED")
            record = ["file", stat.S_IMODE(info.st_mode), total, digest.hexdigest()]
            update(sink, record)
            if cached:
                update(cache_hash, record)
        finally:
            os.close(fd)

    config_file = os.path.join(output, ".config")
    try:
        info = remember(config_file)
        if not stat.S_ISREG(info.st_mode):
            raise Blocked("BLOCKED_CONTENT_UNSAFE")
        counts["entries"] += 1
        read_file(config_file, info, configuration)
        # The declaration is parsed as text, never evaluated as shell or Make.
        with open(config_file, "rb") as stream:
            config_bytes = stream.read(limits["maxFileBytes"] + 1)
    except FileNotFoundError:
        absent.add(config_file)
        configuration.update(b"missing-config\n")
        config_bytes = b""
    cache_root = os.path.join(source, "dl")
    cache = None
    if os.path.lexists(cache_root):
        declarations = [line for line in config_bytes.splitlines() if line.startswith(b"BR2_DL_DIR=")]
        if declarations != [b'BR2_DL_DIR="$(TOPDIR)/dl"']:
            raise Blocked("BLOCKED_CACHE_DISPOSITION_UNSUPPORTED")
        info = remember(cache_root)
        if not stat.S_ISDIR(info.st_mode) or os.path.realpath(cache_root) != cache_root:
            raise Blocked("BLOCKED_CONTENT_UNSAFE")
        identity = hashlib.sha256(json.dumps([info.st_dev, info.st_ino]).encode()).hexdigest()
        declaration = hashlib.sha256(b'BR2_DL_DIR="$(TOPDIR)/dl"').hexdigest()
        cache = dict(disposition="buildroot-default-download-cache-v1", identitySha256=identity,
                     configurationSha256=declaration, maxFileBytes=CACHE_FILE_LIMIT)
        update(content, ["download-cache", declaration, identity])

    def walk(root, relative="", depth=0, git_refs=False):
        check()
        if depth > limits["maxDepth"]:
            raise Blocked("BLOCKED_CONTENT_LIMIT")
        file = os.path.join(root, relative) if relative else root
        info = remember(file)
        counts["entries"] += 1
        cached = cache is not None and (file == cache_root or file.startswith(cache_root + os.sep))
        if cached:
            counts["cacheEntries"] += 1
            update(cache_hash, ["entry", os.path.relpath(file, cache_root)])
        check()
        update(content, ["entry", relative])
        if stat.S_ISLNK(info.st_mode):
            if ".git" in relative.split(os.sep):
                raise Blocked("BLOCKED_CONTENT_UNSAFE")
            target = os.readlink(os.fsencode(file))
            counts["bytes"] += len(target)
            counts["symlinks"] += 1
            if cached:
                counts["cacheBytes"] += len(target)
                update(cache_hash, ["symlink", len(target), hashlib.sha256(target).hexdigest()])
            check()
            update(content, ["symlink", len(target), hashlib.sha256(target).hexdigest()])
            links.append(file)
        elif stat.S_ISDIR(info.st_mode):
            update(content, ["directory", stat.S_IMODE(info.st_mode)])
            children = sorted(os.listdir(os.fsencode(file)))
            for raw in children:
                try:
                    name = raw.decode("utf8", "strict")
                except UnicodeError:
                    raise Blocked("BLOCKED_CONTENT_UNSAFE")
                if name == ".git" and not cached and not git_refs:
                    continue
                walk(root, os.path.join(relative, name), depth + 1, git_refs)
        elif stat.S_ISREG(info.st_mode):
            read_file(file, info, content, cached)
        else:
            raise Blocked("BLOCKED_CONTENT_UNSAFE")

    for index, root in enumerate(roots):
        update(content, ["tree", index, root])
        git_dir = os.path.join(root, ".git")
        if os.path.lexists(git_dir):
            info = remember(git_dir)
            if not stat.S_ISDIR(info.st_mode) or os.path.realpath(git_dir) != git_dir:
                raise Blocked("BLOCKED_CONTENT_UNSAFE")
            for name in ("HEAD", "packed-refs", "shallow", "refs"):
                selected = os.path.join(git_dir, name)
                if os.path.lexists(selected):
                    walk(root, os.path.join(".git", name), git_refs=True)
                else:
                    absent.add(selected)
                    update(content, ["git-reference-missing", name])
        else:
            absent.add(git_dir)
            content.update(b"git-metadata-absent\n")
        walk(root)
    # Every existing referent must be among the fully read captured objects.
    # Missing referents are bound as absent and checked again before returning.
    for file in links:
        check()
        target = os.path.realpath(file)
        if os.path.lexists(target):
            if target not in evidence or stat.S_ISLNK(os.lstat(target).st_mode) or not any(target == root or target.startswith(root + os.sep) for root in roots):
                raise Blocked("BLOCKED_CONTENT_UNBOUND_SYMLINK")
            update(content, ["bound-link", file, target])
        else:
            absent.add(target)
            update(content, ["missing-link-target", file, target])
    for file, original in evidence.items():
        check()
        if fingerprint(os.lstat(file)) != original:
            raise Blocked("BLOCKED_CONTENT_CHANGED")
    if (os.lstat(output).st_dev, os.lstat(output).st_ino) != output_identity:
        raise Blocked("BLOCKED_PATH_CHANGED")
    for file in absent:
        check()
        if os.path.lexists(file):
            raise Blocked("BLOCKED_CONTENT_CHANGED")
    if cache:
        cache.update(entries=counts["cacheEntries"], bytes=counts["cacheBytes"], contentRevision=cache_hash.hexdigest())
    return dict(sourceRevision=content.hexdigest(), configRevision=configuration.hexdigest(), snapshot=dict(
        version=3, entries=counts["entries"], bytes=counts["bytes"], excludesGitObjectHistory=True,
        symlinkPolicy="internal-content-and-missing-targets", symlinks=counts["symlinks"], limitations=[],
        limits=limits, downloadCache=cache))


def main():
    if os.getuid() == 0:
        raise Blocked("BLOCKED_CONTENT_AUTHORITY")
    if os.environ.get("MATERIAL_INTENT_HANDSHAKE") == "1":
        fields = open("/proc/self/stat").read().split(") ", 1)[1].split()
        owner = dict(bootId=open("/proc/sys/kernel/random/boot_id").read().strip(),
                     pidNamespace=os.readlink("/proc/self/ns/pid"), pid=os.getpid(), startTime=fields[19])
        print("MATERIAL_INTENT_OWNER=" + json.dumps(owner), file=sys.stderr, flush=True)
    raw = sys.stdin.buffer.readline(16385)
    if len(raw) > 16384:
        raise Blocked("BLOCKED_CONTENT_LIMIT")
    try:
        result = capture(json.loads(raw))
        print(json.dumps(dict(ok=True, result=result), separators=(",", ":")), flush=True)
    except Blocked as error:
        print(json.dumps(dict(ok=False, code=str(error))), flush=True)
    except Exception:
        print(json.dumps(dict(ok=False, code="BLOCKED_CONTENT_UNAVAILABLE")), flush=True)


if __name__ == "__main__":
    main()
