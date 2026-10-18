"""Fixed internal ISO file lifecycle observations, without producer authority."""
import ctypes
import hashlib
import json
import os
import re
import stat
import sys
import time

ISO = "rootfs.iso9660"
PRIVATE = ".material-iso-lifecycle"
MAX_ISO = 4 * 1024 ** 3


def fail():
    raise ValueError("ISO_LIFECYCLE_UNVERIFIED")


def identity(info):
    return [str(value) for value in (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid)]


def file_identity(info):
    return identity(info) + [str(value) for value in (info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)]


class Directories:
    def __init__(self, root):
        self.fds, self.chain = [], []
        self.started = time.monotonic()
        try:
            self.initialize(root)
        except Exception:
            self.close()
            raise

    def initialize(self, root):
        if not isinstance(root, str) or len(root) > 4096 or not root.startswith("/") or os.path.normpath(root) != root or any(c in root for c in "\0\r\n"):
            fail()
        self.root = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        self.fds.append(self.root)
        for part in root.split("/")[1:]:
            if not part:
                fail()
            self.root = self.child(self.root, part)
        info = os.fstat(self.root)
        if info.st_uid != os.getuid():
            fail()
        self.device = info.st_dev

    def check(self):
        if time.monotonic() - self.started > 60:
            fail()
        for parent, name, original in self.chain:
            if identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) != original:
                fail()

    def child(self, parent, name, create=False):
        if create:
            try:
                os.mkdir(name, 0o700, dir_fd=parent)
            except FileExistsError:
                pass
        info = os.stat(name, dir_fd=parent, follow_symlinks=False)
        if not stat.S_ISDIR(info.st_mode):
            fail()
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
        self.fds.append(fd)
        if identity(os.fstat(fd)) != identity(info):
            fail()
        if hasattr(self, "device") and (info.st_dev != self.device or info.st_uid != os.getuid()):
            fail()
        self.chain.append((parent, name, identity(info)))
        return fd

    def close(self):
        for fd in reversed(self.fds):
            os.close(fd)


def inspect_iso(fd, size):
    def read(offset, length):
        if offset < 0 or offset + length > size:
            return None
        data = os.pread(fd, length, offset)
        return data if len(data) == length else None
    primary, catalog_lba = None, None
    for sector in range(16, 80):
        descriptor = read(sector * 2048, 2048)
        if descriptor is None or descriptor[1:6] != b"CD001" or descriptor[6] != 1:
            break
        if descriptor[0] == 1:
            primary = descriptor
        if descriptor[0] == 0 and descriptor[7:30].split(b"\0")[0].strip() == b"EL TORITO SPECIFICATION":
            catalog_lba = int.from_bytes(descriptor[71:75], "little")
        if descriptor[0] == 255:
            break
    if primary is None:
        fail()
    sectors, block = int.from_bytes(primary[80:84], "little"), int.from_bytes(primary[128:130], "little")
    valid = sectors > 0 and int.from_bytes(primary[84:88], "big") == sectors and block == 2048 and int.from_bytes(primary[130:132], "big") == block
    catalog = None if catalog_lba is None else read(catalog_lba * 2048, 64)
    checksum = bool(catalog) and catalog[0] == 1 and catalog[30:32] == b"\x55\xaa" and sum(int.from_bytes(catalog[i:i+2], "little") for i in range(0, 32, 2)) % 65536 == 0
    image_lba = int.from_bytes(catalog[40:44], "little") if catalog else 0
    load = int.from_bytes(catalog[38:40], "little") if catalog else 0
    boot_entry = checksum and catalog[32] == 0x88 and catalog[33] <= 4 and load > 0 and image_lba > 0 and image_lba * 2048 + load * 512 <= size
    return {"descriptorValid": valid, "withinImage": valid and sectors * block <= size,
            "biosCatalogValid": bool(boot_entry and catalog[1] == 0), "bootVerified": False}


def read_file(directories, parent, name, maximum, structure=False):
    before = os.stat(name, dir_fd=parent, follow_symlinks=False)
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > maximum or before.st_uid != os.getuid():
        fail()
    fd = os.open(name, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW, dir_fd=parent)
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or opened.st_uid != os.getuid() or file_identity(opened) != file_identity(before):
            fail()
        digest, total = hashlib.sha256(), 0
        while True:
            directories.check()
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            total += len(chunk)
            if total > maximum or total > before.st_size:
                fail()
            digest.update(chunk)
        iso = inspect_iso(fd, total) if structure else None
        if total != before.st_size or file_identity(os.fstat(fd)) != file_identity(before) or file_identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) != file_identity(before):
            fail()
        directories.check()
        return {"sha256": digest.hexdigest(), "bytes": total, "identity": file_identity(before), **({"structure": iso} if structure else {})}
    finally:
        os.close(fd)


def rename_exclusive(source, source_name, destination, destination_name):
    # No overwrite-capable fallback: unsupported kernels leave existing bytes intact.
    libc = ctypes.CDLL(None, use_errno=True)
    rename = getattr(libc, "renameat2", None)
    if rename is None:
        fail()
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(source, os.fsencode(source_name), destination, os.fsencode(destination_name), 1) != 0:
        raise OSError(ctypes.get_errno(), "ISO_PRESERVATION_UNAVAILABLE")


def run(request):
    if os.getuid() == 0 or not isinstance(request, dict):
        fail()
    operation = request.get("operation")
    keys = {"operation", "outputRoot", "jobId"} | ({"preparationSha256"} if operation == "capture" else set())
    if set(request) != keys or operation not in ("prepare", "capture") or not isinstance(request["jobId"], str) or not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", request["jobId"]):
        fail()
    if operation == "capture" and (not isinstance(request["preparationSha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", request["preparationSha256"])):
        fail()
    directories = Directories(request["outputRoot"])
    try:
        images = directories.child(directories.root, "images", operation == "prepare")
        private = directories.child(directories.root, PRIVATE, operation == "prepare")
        if os.fstat(private).st_mode & 0o077:
            fail()
        if operation == "prepare":
            os.mkdir(request["jobId"], 0o700, dir_fd=private)
        job = directories.child(private, request["jobId"])
        if os.fstat(job).st_mode & 0o077:
            fail()
        if operation == "prepare":
            prior = None
            try:
                prior = read_file(directories, images, ISO, MAX_ISO)
            except FileNotFoundError:
                pass
            if prior is not None:
                directories.check()
                if file_identity(os.stat(ISO, dir_fd=images, follow_symlinks=False)) != prior["identity"]:
                    fail()
                rename_exclusive(images, ISO, job, "previous.iso9660")
                preserved = read_file(directories, job, "previous.iso9660", MAX_ISO)
                if preserved["sha256"] != prior["sha256"] or preserved["bytes"] != prior["bytes"] or preserved["identity"][:2] != prior["identity"][:2]:
                    fail()
                os.fsync(images)
                os.fsync(job)
            try:
                os.stat(ISO, dir_fd=images, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                fail()
            state = {"version": 1, "state": "prepared-unbound", "jobId": request["jobId"],
                     "rootIdentity": identity(os.fstat(directories.root)), "imagesIdentity": identity(os.fstat(images)),
                     "jobIdentity": identity(os.fstat(job)), "prior": prior, "productionPathAbsent": True}
            raw = (json.dumps(state, sort_keys=True, separators=(",", ":")) + "\n").encode()
            fd = os.open("state.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=job)
            try:
                with os.fdopen(fd, "wb", closefd=False) as stream:
                    stream.write(raw)
                    stream.flush()
                    os.fsync(fd)
            finally:
                os.close(fd)
            os.fsync(job)
            directories.check()
            return {"state": "prepared-unbound", "preparationSha256": hashlib.sha256(raw).hexdigest(), "jobId": request["jobId"], "prior": prior, "jobBound": False, "bootVerified": False}
        state_file = read_file(directories, job, "state.json", 16384)
        if state_file["sha256"] != request["preparationSha256"]:
            fail()
        fd = os.open("state.json", os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW, dir_fd=job)
        try:
            opened = os.fstat(fd)
            if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1 or opened.st_uid != os.getuid() or file_identity(opened) != state_file["identity"]:
                fail()
            raw = os.read(fd, 16385)
            if hashlib.sha256(raw).hexdigest() != request["preparationSha256"] or file_identity(os.fstat(fd)) != state_file["identity"] or file_identity(os.stat("state.json", dir_fd=job, follow_symlinks=False)) != state_file["identity"]:
                fail()
            state = json.loads(raw)
        finally:
            os.close(fd)
        if set(state) != {"version", "state", "jobId", "rootIdentity", "imagesIdentity", "jobIdentity", "prior", "productionPathAbsent"} or state["version"] != 1 or state["state"] != "prepared-unbound" or state["jobId"] != request["jobId"] or state["productionPathAbsent"] is not True or state["rootIdentity"] != identity(os.fstat(directories.root)) or state["imagesIdentity"] != identity(os.fstat(images)) or state["jobIdentity"] != identity(os.fstat(job)):
            fail()
        result = read_file(directories, images, ISO, MAX_ISO, True)
        if state["prior"] is not None:
            preserved = read_file(directories, job, "previous.iso9660", MAX_ISO)
            if preserved["sha256"] != state["prior"]["sha256"] or preserved["bytes"] != state["prior"]["bytes"] or preserved["identity"][:2] != state["prior"]["identity"][:2]:
                fail()
        if not all(result["structure"][key] for key in ("descriptorValid", "withinImage", "biosCatalogValid")):
            fail()
        if read_file(directories, job, "state.json", 16384)["sha256"] != request["preparationSha256"]:
            fail()
        return {"state": "fresh-file-observed-unbound", "jobId": request["jobId"], "preparationSha256": request["preparationSha256"],
                "output": result, "jobBound": False, "producerVerified": False, "cleanupVerified": False, "bootVerified": False}
    finally:
        directories.close()


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.readline(8193)
        if len(raw) > 8192:
            fail()
        print(json.dumps({"ok": True, "result": run(json.loads(raw))}), flush=True)
    except Exception:
        print(json.dumps({"ok": False, "code": "ISO_LIFECYCLE_UNVERIFIED"}), flush=True)
        sys.exit(78)
