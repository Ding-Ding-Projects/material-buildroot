"""Offline non-root synthetic filesystem checks for the fixed internal helper."""
import hashlib
import os
import pathlib
import tempfile
import unittest
import uuid
from iso_output_lifecycle import run, PRIVATE, ISO


def image():
    data = bytearray(25 * 2048)
    def descriptor(sector, kind):
        at = sector * 2048
        data[at] = kind
        data[at+1:at+6] = b"CD001"
        data[at+6] = 1
        return at
    p = descriptor(16, 1)
    data[p+80:p+84] = (25).to_bytes(4, "little")
    data[p+84:p+88] = (25).to_bytes(4, "big")
    data[p+128:p+130] = (2048).to_bytes(2, "little")
    data[p+130:p+132] = (2048).to_bytes(2, "big")
    b = descriptor(17, 0)
    data[b+7:b+30] = b"EL TORITO SPECIFICATION"
    data[b+71:b+75] = (20).to_bytes(4, "little")
    descriptor(18, 255)
    c = 20 * 2048
    data[c] = 1
    data[c+30:c+32] = b"\x55\xaa"
    data[c+28:c+30] = ((-0xaa56) & 0xffff).to_bytes(2, "little")
    data[c+32] = 0x88
    data[c+38:c+40] = (4).to_bytes(2, "little")
    data[c+40:c+44] = (21).to_bytes(4, "little")
    return bytes(data)


class Lifecycle(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="iso-lifecycle-", dir="/fixture")
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        self.job = str(uuid.uuid4())
        self.iso = self.root / "images" / ISO

    def request(self, operation, **extra):
        return run(dict(operation=operation, outputRoot=str(self.root), jobId=self.job, **extra))

    def prepare(self, prior=None):
        if prior is not None:
            self.iso.parent.mkdir()
            self.iso.write_bytes(prior)
        return self.request("prepare")

    def capture(self, prepared, **extra):
        return self.request("capture", preparationSha256=prepared["preparationSha256"], **extra)

    def test_prior_preserved_and_no_new_file_rejected(self):
        prior = image()
        prepared = self.prepare(prior)
        saved = self.root / PRIVATE / self.job / "previous.iso9660"
        self.assertEqual(saved.read_bytes(), prior)
        self.assertFalse(self.iso.exists())
        with self.assertRaises(Exception):
            self.capture(prepared)
        self.assertEqual(saved.read_bytes(), prior)

    def test_identical_new_bytes_observed_without_job_or_boot_claim(self):
        prepared = self.prepare(image())
        self.iso.write_bytes(image())
        result = self.capture(prepared)
        self.assertEqual(result["output"]["sha256"], hashlib.sha256(image()).hexdigest())
        self.assertEqual(result["state"], "fresh-file-observed-unbound")
        for field in ("jobBound", "producerVerified", "cleanupVerified", "bootVerified"):
            self.assertIs(result[field], False)
        self.assertIs(result["output"]["structure"]["bootVerified"], False)

    def test_job_collision_and_wrong_job_rejected(self):
        prepared = self.prepare(image())
        with self.assertRaises(Exception):
            self.request("prepare")
        self.job = str(uuid.uuid4())
        with self.assertRaises(Exception):
            self.capture(prepared)

    def test_aliases_and_hardlinks_never_move_prior_bytes(self):
        self.iso.parent.mkdir()
        outside = self.root / "outside"
        outside.write_bytes(image())
        for kind in ("symlink", "hardlink"):
            if kind == "symlink":
                self.iso.symlink_to(outside)
            else:
                os.link(outside, self.iso)
            with self.assertRaises(Exception):
                self.request("prepare")
            self.assertEqual(outside.read_bytes(), image())
            self.iso.unlink()
            self.job = str(uuid.uuid4())

    def test_root_and_images_aliases_rejected(self):
        outside = self.root / "outside"
        outside.mkdir()
        self.iso.parent.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(Exception):
            self.request("prepare")
        self.iso.parent.unlink()
        alias = self.root / "alias"
        alias.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(Exception):
            run(dict(operation="prepare", outputRoot=str(alias), jobId=self.job))
        self.assertEqual(list(outside.iterdir()), [])

    def test_state_tamper_and_changed_images_identity_rejected(self):
        prepared = self.prepare()
        state = self.root / PRIVATE / self.job / "state.json"
        original = state.read_bytes()
        state.write_bytes(original + b" ")
        self.iso.write_bytes(image())
        with self.assertRaises(Exception):
            self.capture(prepared)
        state.write_bytes(original)
        self.iso.parent.rename(self.root / "old-images")
        self.iso.parent.mkdir()
        self.iso.write_bytes(image())
        with self.assertRaises(Exception):
            self.capture(prepared)

    def test_partial_and_asserted_producer_outcomes_rejected(self):
        prepared = self.prepare(image())
        self.iso.write_bytes(b"partial")
        with self.assertRaises(Exception):
            self.capture(prepared)
        self.assertEqual(self.iso.read_bytes(), b"partial")
        for value in (False, True):
            with self.assertRaises(Exception):
                self.capture(prepared, producerSucceeded=value)
        self.iso.write_bytes(image())
        with self.assertRaises(Exception):
            self.capture(prepared, path="other.iso")

    def test_preserved_prior_tamper_and_production_link_rejected(self):
        prepared = self.prepare(image())
        saved = self.root / PRIVATE / self.job / "previous.iso9660"
        self.iso.symlink_to(saved)
        with self.assertRaises(Exception):
            self.capture(prepared)
        self.iso.unlink()
        self.iso.write_bytes(image())
        saved.write_bytes(b"changed")
        with self.assertRaises(Exception):
            self.capture(prepared)
        self.assertEqual(saved.read_bytes(), b"changed")
        self.assertEqual(self.iso.read_bytes(), image())


if __name__ == "__main__":
    unittest.main(verbosity=2)
