"""Bound Docker-save references to hashed configuration and optional OCI graphs."""
import gzip
import hashlib
import json
from pathlib import PurePosixPath
import re
import tarfile

MAX_METADATA = 4 * 1024 * 1024
MAX_LAYER = 32 * 1024 ** 3
MAX_TOTAL = 128 * 1024 ** 3
MANIFEST_TYPES = {'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'}
INDEX_TYPES = {'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'}
PLAIN_LAYERS = {'application/vnd.oci.image.layer.v1.tar', 'application/vnd.docker.image.rootfs.diff.tar'}
GZIP_LAYERS = {'application/vnd.oci.image.layer.v1.tar+gzip', 'application/vnd.docker.image.rootfs.diff.tar.gzip'}
CONFIG_TYPES = {'application/vnd.oci.image.config.v1+json', 'application/vnd.docker.container.image.v1+json'}


class Inventory(dict):
    def __init__(self):
        super().__init__()
        self.content_ids = {}
        self.configurations = {}

    def matches(self, reference, identity):
        return self.get(reference) == identity or identity in self.content_ids.get(reference, set())


def inspect_archive(path):
    inventory = Inventory()
    with tarfile.open(path, 'r:*') as archive:
        members = {}
        for member in archive:
            if len(members) >= 100000 or not (member.isfile() or member.isdir()) or member.name.startswith('/') or '..' in PurePosixPath(member.name).parts or '\\' in member.name:
                raise ValueError('Unsafe or excessive outer archive inventory')
            if member.name in members:
                raise ValueError('Duplicate archive members are unsupported')
            members[member.name] = member

        def read(name, limit=MAX_METADATA):
            member = members.get(name)
            if member is None or not member.isfile() or not 0 <= member.size <= limit:
                raise ValueError('Invalid archive metadata')
            with archive.extractfile(member) as stream:
                return stream.read()

        def blob(descriptor, limit=MAX_METADATA):
            if not isinstance(descriptor, dict) or not re.fullmatch('sha256:[a-f0-9]{64}', descriptor.get('digest', '')) or type(descriptor.get('size')) is not int or not 0 <= descriptor['size'] <= limit:
                raise ValueError('Invalid OCI descriptor schema')
            content = read('blobs/sha256/' + descriptor['digest'][7:], limit)
            if len(content) != descriptor['size'] or 'sha256:' + hashlib.sha256(content).hexdigest() != descriptor['digest']:
                raise ValueError('OCI descriptor content identity mismatch')
            return content

        if 'manifest.json' not in members:
            raise ValueError('Only Docker save archives with manifest.json are supported')
        records = json.loads(read('manifest.json', 1024 * 1024))
        if not isinstance(records, list) or not 1 <= len(records) <= 256:
            raise ValueError('Invalid Docker archive inventory')
        configurations = {}
        for record in records:
            content = read(record['Config'])
            identity = 'sha256:' + hashlib.sha256(content).hexdigest()
            config = json.loads(content)
            if config.get('os') != 'linux' or config.get('architecture') != 'amd64':
                raise ValueError('Archive images must be linux/amd64')
            configurations[identity] = config
            inventory.configurations[identity] = config
            tags = record.get('RepoTags') or []
            if not isinstance(tags, list) or len(tags) > 256 or any(not isinstance(tag, str) for tag in tags):
                raise ValueError('Invalid Docker archive references')
            for reference in tags + [identity]:
                if reference in inventory and inventory[reference] != identity:
                    raise ValueError('Conflicting Docker archive image references')
                inventory[reference] = identity

        # A legacy Docker-save archive has no OCI graph. Its configuration digest
        # remains the only acceptable identity; no representation is guessed.
        if 'index.json' not in members:
            return inventory
        index = json.loads(read('index.json'))
        if index.get('schemaVersion') != 2 or not isinstance(index.get('manifests'), list) or len(index['manifests']) > 256:
            raise ValueError('Invalid OCI archive index')
        checked_layers = {}
        visited = {}
        node_count = 0
        total_bytes = 0

        def hash_stream(stream, limit):
            digest = hashlib.sha256()
            count = 0
            while chunk := stream.read(1024 * 1024):
                count += len(chunk)
                if count > limit:
                    raise ValueError('OCI layer exceeds verification bound')
                digest.update(chunk)
            return 'sha256:' + digest.hexdigest(), count

        def layer_identity(descriptor, expected_diff):
            nonlocal total_bytes
            digest = descriptor.get('digest', '')
            if not re.fullmatch('sha256:[a-f0-9]{64}', digest) or type(descriptor.get('size')) is not int or not 0 <= descriptor['size'] <= MAX_LAYER or not re.fullmatch('sha256:[a-f0-9]{64}', expected_diff):
                raise ValueError('Invalid OCI layer descriptor')
            if digest in checked_layers:
                if checked_layers[digest] != expected_diff:
                    raise ValueError('OCI layer/configuration relationship mismatch')
                return
            media = descriptor.get('mediaType')
            if media not in PLAIN_LAYERS | GZIP_LAYERS:
                raise ValueError('Unsupported OCI layer compression')
            member = members.get('blobs/sha256/' + digest[7:])
            if member is None or not member.isfile() or member.size != descriptor['size']:
                raise ValueError('OCI layer blob is unavailable')
            total_bytes += member.size
            if total_bytes > MAX_TOTAL:
                raise ValueError('OCI graph exceeds verification bound')
            with archive.extractfile(member) as stream:
                actual, _ = hash_stream(stream, MAX_LAYER)
            if actual != digest:
                raise ValueError('OCI layer content identity mismatch')
            if media in GZIP_LAYERS:
                with archive.extractfile(member) as stream, gzip.GzipFile(fileobj=stream) as decompressed:
                    diff, expanded = hash_stream(decompressed, MAX_LAYER)
                    total_bytes += expanded
            else:
                diff = actual
            if total_bytes > MAX_TOTAL or diff != expected_diff:
                raise ValueError('OCI layer/configuration relationship mismatch')
            checked_layers[digest] = diff

        def walk(descriptor, depth=0):
            nonlocal node_count
            if depth > 4:
                raise ValueError('OCI graph depth exceeds verification bound')
            digest = descriptor.get('digest', '')
            if digest in visited:
                return visited[digest]
            node_count += 1
            if node_count > 1024:
                raise ValueError('OCI graph exceeds verification bound')
            document = json.loads(blob(descriptor))
            if document.get('schemaVersion') != 2:
                raise ValueError('Invalid OCI graph schema')
            media = descriptor.get('mediaType')
            result = {}
            if media in INDEX_TYPES:
                children = document.get('manifests')
                if not isinstance(children, list) or not 1 <= len(children) <= 256:
                    raise ValueError('Invalid OCI nested index')
                for child in children:
                    platform = child.get('platform', {})
                    if platform and (platform.get('os') != 'linux' or platform.get('architecture') != 'amd64'):
                        continue
                    for config_id, identities in walk(child, depth + 1).items():
                        result.setdefault(config_id, set()).update(identities)
            elif media in MANIFEST_TYPES:
                config_descriptor = document.get('config', {})
                if config_descriptor.get('mediaType') not in CONFIG_TYPES:
                    raise ValueError('Unsupported OCI configuration descriptor')
                content = blob(config_descriptor)
                config_id = config_descriptor['digest']
                config = json.loads(content)
                if config_id not in configurations or config != configurations[config_id]:
                    raise ValueError('OCI manifest configuration differs from Docker archive')
                layers = document.get('layers')
                diffs = config.get('rootfs', {}).get('diff_ids')
                if not isinstance(layers, list) or not isinstance(diffs, list) or len(layers) != len(diffs) or len(layers) > 512:
                    raise ValueError('Invalid OCI configuration/layer inventory')
                for layer, diff in zip(layers, diffs):
                    layer_identity(layer, diff)
                result[config_id] = {config_id}
            else:
                raise ValueError('Unsupported OCI graph descriptor')
            for identities in result.values():
                identities.add(digest)
            visited[digest] = result
            return result

        graphs = {}
        for descriptor in index['manifests']:
            for config_id, identities in walk(descriptor).items():
                graphs.setdefault(config_id, set()).update(identities)
        for reference, config_id in inventory.items():
            inventory.content_ids[reference] = graphs.get(config_id, set())
    return inventory
