"""Fixed operations for an application-owned native Docker workspace."""
import hashlib
import json
import os
import pathlib
import stat
import sys
import tarfile
import time

ARCHIVE_SHA256 = "33ba6d3f5907e18041a5ed079776cc9269df59703700427f93dc61c3387801c0"
ARCHIVE_ROOT = "buildroot-buildroot-aa2d7ca"


def file_hash(file, maximum=512 * 1024 * 1024):
    info = os.lstat(file)
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > maximum:
        raise ValueError("native-file-unavailable")
    digest = hashlib.sha256()
    fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns):
            raise ValueError("native-file-changed")
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            digest.update(chunk)
        after = os.fstat(fd)
        if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError("native-file-changed")
    finally:
        os.close(fd)
    return digest.hexdigest(), info.st_size


def identity(root):
    info = os.lstat(root)
    if os.path.realpath(root) != root or not stat.S_ISDIR(info.st_mode) or info.st_uid != 1000:
        raise ValueError("native-volume-identity-unavailable")
    return [info.st_dev, info.st_ino, info.st_uid, info.st_gid]


def tree_receipt(root, maximum=64 * 1024 * 1024):
    digest = hashlib.sha256()
    entries, total = 0, 0
    pending = 0
    started = time.monotonic()
    evidence = {}
    def check():
        if time.monotonic() - started > 10:
            raise ValueError("native-content-limit")
    def fingerprint(info):
        return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
    root_info = os.lstat(root)
    def visit(file, depth=1):
        nonlocal entries, total, pending
        check()
        entries += 1
        if entries > 50000 or depth > 64:
            raise ValueError("native-content-limit")
        info = os.lstat(file)
        if info.st_uid != 1000:
            raise ValueError("native-content-owner-changed")
        evidence[file] = fingerprint(info)
        relative = os.path.relpath(file, root)
        if stat.S_ISLNK(info.st_mode):
            content = os.readlink(os.fsencode(file))
            total += len(content)
            row = [relative, "link", hashlib.sha256(content).hexdigest()]
        elif stat.S_ISREG(info.st_mode):
            value, length = file_hash(file, maximum)
            total += length
            row = [relative, "file", stat.S_IMODE(info.st_mode), length, value]
        elif stat.S_ISDIR(info.st_mode):
            row = [relative, "directory", stat.S_IMODE(info.st_mode)]
        else:
            raise ValueError("native-content-type-unavailable")
        if total > 512 * 1024 * 1024:
            raise ValueError("native-content-limit")
        digest.update((json.dumps(row, separators=(",", ":")) + "\n").encode())
        if stat.S_ISDIR(info.st_mode):
            names = []
            with os.scandir(file) as directory:
                for entry in directory:
                    check()
                    if entries + pending >= 50000:
                        raise ValueError("native-content-limit")
                    pending += 1
                    names.append(entry.name)
            for name in sorted(names):
                pending -= 1
                visit(os.path.join(file, name), depth + 1)
    with os.scandir(root) as directory:
        names = []
        for entry in directory:
            check()
            if pending >= 50000:
                raise ValueError("native-content-limit")
            pending += 1
            names.append(entry.name)
    for name in sorted(names):
        pending -= 1
        visit(os.path.join(root, name))
    for file, before in evidence.items():
        check()
        if fingerprint(os.lstat(file)) != before:
            raise ValueError("native-content-changed")
    if fingerprint(os.lstat(root)) != fingerprint(root_info):
        raise ValueError("native-content-changed")
    return dict(sha256=digest.hexdigest(), entries=entries, bytes=total)


def prepare():
    if file_hash("/archive.tar.gz", 64 * 1024 * 1024)[0] != ARCHIVE_SHA256:
        raise ValueError("native-source-archive-mismatch")
    for root in ("/source", "/output"):
        with os.scandir(root) as directory:
            if next(directory, None) is not None:
                raise ValueError("native-workspace-not-empty")
    total, count = 0, 0
    with tarfile.open("/archive.tar.gz", "r:gz") as archive:
        for member in archive:
            count += 1
            parts = pathlib.PurePosixPath(member.name).parts
            if not parts or parts[0] != ARCHIVE_ROOT or any(part in ("", ".", "..") for part in parts):
                raise ValueError("native-source-path-invalid")
            if len(parts) == 1:
                continue
            if count > 50000 or member.size > 64 * 1024 * 1024:
                raise ValueError("native-source-limit")
            total += member.size
            if total > 512 * 1024 * 1024:
                raise ValueError("native-source-limit")
            destination = pathlib.Path("/source").joinpath(*parts[1:])
            parent = destination.parent
            parent.mkdir(parents=True, exist_ok=True)
            if os.path.realpath(parent) != str(parent):
                raise ValueError("native-source-parent-invalid")
            if member.isdir():
                destination.mkdir(exist_ok=True)
                os.chmod(destination, member.mode & 0o777)
            elif member.isfile():
                fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, member.mode & 0o777)
                with os.fdopen(fd, "wb") as output, archive.extractfile(member) as content:
                    while True:
                        chunk = content.read(65536)
                        if not chunk:
                            break
                        output.write(chunk)
            elif member.issym():
                os.symlink(member.linkname, destination)
            else:
                raise ValueError("native-source-entry-invalid")
    base = pathlib.Path("/source/configs/qemu_x86_64_defconfig").read_text()
    lines = [line for line in base.splitlines() if not line.startswith(("BR2_PACKAGE_HOST_QEMU", "BR2_ROOTFS_POST_"))]
    lines += ["BR2_TARGET_GRUB2=y", "BR2_TARGET_GRUB2_I386_PC=y", 'BR2_TARGET_GRUB2_BOOT_PARTITION="cd"',
              'BR2_TARGET_GRUB2_BUILTIN_MODULES_PC="boot linux iso9660 normal biosdisk"',
              'BR2_TARGET_GRUB2_BUILTIN_CONFIG_PC=""', "BR2_TARGET_ROOTFS_ISO9660=y",
              "BR2_TARGET_ROOTFS_ISO9660_GRUB2=y", 'BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU="fs/iso9660/grub.cfg"',
              "BR2_TARGET_ROOTFS_ISO9660_INITRD=y", 'BR2_DL_DIR="/cache"', "BR2_DOWNLOAD_FORCE_CHECK_HASHES=y"]
    pathlib.Path("/output/.config").write_text("\n".join(lines) + "\n")
    return snapshot()


def snapshot():
    if os.getuid() != 1000 or os.getgid() != 1000:
        raise ValueError("native-non-root-required")
    roots = {name: identity("/" + name) for name in ("source", "output", "cache")}
    source = tree_receipt("/source")
    config, config_bytes = file_hash("/output/.config", 4 * 1024 * 1024)
    lines = pathlib.Path("/output/.config").read_text().splitlines()
    if 'BR2_DL_DIR="/cache"' not in lines or "BR2_DOWNLOAD_FORCE_CHECK_HASHES=y" not in lines:
        raise ValueError("native-cache-policy-changed")
    return dict(uid=os.getuid(), gid=os.getgid(), identities=roots, source=source, configurationSha256=config, configurationBytes=config_bytes)


def readmit(expected):
    if file_hash("/archive.tar.gz", 64 * 1024 * 1024)[0] != ARCHIVE_SHA256:
        raise ValueError("native-source-archive-mismatch")
    expected_names = set()
    with tarfile.open("/archive.tar.gz", "r:gz") as archive:
        for member in archive:
            parts = pathlib.PurePosixPath(member.name).parts
            if not parts or parts[0] != ARCHIVE_ROOT or any(part in ("", ".", "..") for part in parts):
                raise ValueError("native-source-path-invalid")
            if len(parts) == 1:
                continue
            relative = "/".join(parts[1:])
            if relative in expected_names or len(expected_names) >= 50000:
                raise ValueError("native-source-limit")
            expected_names.add(relative)
            file = pathlib.Path("/source").joinpath(*parts[1:])
            if os.path.realpath(file.parent) != str(file.parent):
                raise ValueError("native-source-parent-invalid")
            info = os.lstat(file)
            if member.isdir():
                if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != member.mode & 0o777:
                    raise ValueError("native-source-content-mismatch")
            elif member.issym():
                if not stat.S_ISLNK(info.st_mode) or os.readlink(file) != member.linkname:
                    raise ValueError("native-source-content-mismatch")
            elif member.isfile():
                if member.size > 64 * 1024 * 1024 or not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != member.mode & 0o777:
                    raise ValueError("native-source-content-mismatch")
                digest = hashlib.sha256()
                with archive.extractfile(member) as stream:
                    while True:
                        chunk = stream.read(65536)
                        if not chunk:
                            break
                        digest.update(chunk)
                if file_hash(file, 64 * 1024 * 1024)[0] != digest.hexdigest():
                    raise ValueError("native-source-content-mismatch")
            else:
                raise ValueError("native-source-entry-invalid")
    current = snapshot()
    if current["source"] != expected["source"] or current["source"]["entries"] != len(expected_names) or current["configurationSha256"] != expected["configurationSha256"]:
        raise ValueError("native-workspace-recovery-changed")
    current = verify(current)
    current["cache"] = tree_receipt("/cache", 256 * 1024 * 1024)
    return current


def verify(expected, reconciled=False, acquired=False):
    current = snapshot()
    if current["identities"] != expected["identities"] or current["source"] != expected["source"]:
        raise ValueError("native-workspace-changed")
    if not reconciled and current["configurationSha256"] != expected["configurationSha256"]:
        raise ValueError("native-configuration-changed")
    required = ["BR2_x86_64=y", "BR2_LINUX_KERNEL=y", "BR2_TARGET_GRUB2=y", "BR2_TARGET_GRUB2_I386_PC=y",
                "BR2_TARGET_ROOTFS_ISO9660=y", "BR2_TARGET_ROOTFS_ISO9660_GRUB2=y", "BR2_TARGET_ROOTFS_ISO9660_INITRD=y",
                'BR2_TARGET_GRUB2_BOOT_PARTITION="cd"', 'BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU="fs/iso9660/grub.cfg"']
    lines = pathlib.Path("/output/.config").read_text().splitlines()
    if not all(line in lines for line in required):
        raise ValueError("native-profile-not-effective")
    if expected.get("cache") is not None and not acquired:
        if tree_receipt("/cache", 256 * 1024 * 1024) != expected["cache"]:
            raise ValueError("native-cache-content-changed")
    return current


def outputs(expected):
    current = verify(expected)
    files = []
    for name in ("rootfs.iso9660", "rootfs.cpio", "rootfs.ext2", "bzImage"):
        file = "/output/images/" + name
        if os.path.lexists(file):
            digest, length = file_hash(file, 4 * 1024 * 1024 * 1024)
            files.append(dict(name=name, sha256=digest, bytes=length))
    return dict(workspace=current, files=files)


if __name__ == "__main__":
    try:
        mode = sys.argv[1]
        if mode == "prepare":
            result = prepare()
        elif mode == "verify":
            result = verify(json.loads(sys.argv[2]))
        elif mode == "reconciled":
            result = verify(json.loads(sys.argv[2]), True)
        elif mode == "readmit":
            result = readmit(json.loads(sys.argv[2]))
        elif mode == "outputs":
            result = outputs(json.loads(sys.argv[2]))
        elif mode == "cache":
            result = dict(workspace=verify(json.loads(sys.argv[2])), cache=tree_receipt("/cache", 256 * 1024 * 1024))
        elif mode == "acquired":
            result = dict(workspace=verify(json.loads(sys.argv[2]), acquired=True), cache=tree_receipt("/cache", 256 * 1024 * 1024))
        else:
            raise ValueError("native-operation-unavailable")
        print(json.dumps(result, separators=(",", ":")), flush=True)
    except Exception as error:
        message = str(error)
        if not message or len(message) > 80 or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-" for character in message):
            message = "native-operation-failed"
        print(type(error).__name__ + ":" + message, file=sys.stderr)
        sys.exit(78)
