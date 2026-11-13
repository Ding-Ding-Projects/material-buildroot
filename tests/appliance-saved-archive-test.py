"""The saved image archive must contain every file its manifest names."""
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src/main/appliance'))
from recipe_worker import complete_archive  # noqa: E402


def archive(path, manifest, files):
    with tarfile.open(path, 'w') as stream:
        for name, data in {'manifest.json': json.dumps(manifest).encode(), **files}.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            stream.addfile(info, io.BytesIO(data))


class SavedArchive(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'image.tar'
        self.manifest = [{'Config': 'blobs/sha256/c', 'Layers': ['blobs/sha256/a', 'blobs/sha256/b']}]

    def test_complete_archive_is_accepted(self):
        archive(self.path, self.manifest, {name: b'x' for name in ['blobs/sha256/a', 'blobs/sha256/b', 'blobs/sha256/c']})
        complete_archive(self.path)

    def test_manifest_without_its_layers_is_refused(self):
        # What docker save wrote for a classic-builder image under the containerd image store.
        archive(self.path, self.manifest, {'blobs/sha256/c': b'x'})
        with self.assertRaisesRegex(ValueError, 'missing 2 of 3'):
            complete_archive(self.path)

    def test_empty_manifest_is_refused(self):
        archive(self.path, [], {})
        with self.assertRaises(ValueError):
            complete_archive(self.path)


if __name__ == '__main__':
    unittest.main()
