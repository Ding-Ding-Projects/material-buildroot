#!/usr/bin/env python3
"""Write bounded diagnostic codes, never command text or process output."""
import argparse
import json
from pathlib import Path

STAGES = {'preparing', 'source', 'configuring', 'building', 'packaging'}
TOOLS = {'docker', 'python3', 'curl', 'tar', 'make', 'producer'}
CODES = {'BUILD_STEP_FAILED', 'PRODUCER_INTERNAL_FAILED', 'SPEC_INVALID', 'IO_FAILED',
         'GUEST_ASSETS_UNAVAILABLE', 'ARCHIVE_FORMAT_UNSUPPORTED', 'ARCHIVE_INVALID',
         'SOURCE_IDENTITY_MISMATCH', 'PREPARED_BUNDLE_INVALID', 'CONFIG_INVALID',
         'SAVED_IMAGE_IDENTITY_MISMATCH',
         'DOCKER_DAEMON_UNAVAILABLE', 'REGISTRY_AUTH_REQUIRED', 'REGISTRY_TLS_FAILED',
         'REGISTRY_NETWORK_FAILED', 'DOCKER_PULL_FAILED', 'DOCKER_INSPECT_FAILED',
         'DOCKER_SAVE_FAILED', 'DOCKER_LOAD_FAILED', 'DOCKER_COMPOSE_FAILED', 'DOCKER_TAG_FAILED'}


def write_failure(output, stage, code, tool, exit_code):
    if stage not in STAGES or code not in CODES or tool not in TOOLS or (exit_code is not None and (type(exit_code) is not int or not -255 <= exit_code <= 255)):
        raise ValueError('Invalid diagnostic schema')
    output.mkdir(parents=True, exist_ok=True)
    path = output / 'failure.json'
    # The first causal diagnostic wins over a later generic shell exit.
    if path.exists():
        return
    with path.open('x') as stream:
        json.dump({'schemaVersion': 1, 'stage': stage, 'code': code, 'tool': tool, 'exitCode': exit_code}, stream)
        stream.write('\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--stage', choices=sorted(STAGES), required=True)
    parser.add_argument('--tool', choices=sorted(TOOLS), required=True)
    parser.add_argument('--code', choices=sorted(CODES), default='BUILD_STEP_FAILED')
    parser.add_argument('--exit-code', type=int, required=True)
    args = parser.parse_args()
    write_failure(args.output, args.stage, args.code, args.tool, args.exit_code)
