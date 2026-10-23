#!/usr/bin/env bash
# Build an independent x86-64 Linux live ISO. Never run the source build as root.
set -euo pipefail
umask 077
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ $# == 4 && $1 == --spec && $3 == --output ]] || { echo 'Usage: build-appliance.sh --spec /linux/spec.json --output /linux/output' >&2; exit 2; }
[[ $4 == /* ]] || exit 2
destination=$(realpath -m -- "$4")
stage=preparing
active_tool=producer
report_failure() {
  result=$?
  if [[ $result != 0 ]]; then
    python3 "$here/failure.py" --output "$destination" --stage "$stage" --tool "$active_tool" --exit-code "$result" || true
  fi
}
trap report_failure EXIT
if [[ ${MATERIAL_APPLIANCE_WORKER:-} == 1 ]]; then
  source "$here/linux-build-path.sh"
fi
[[ $(id -u) != 0 ]] || { echo 'Buildroot must run as an unprivileged Linux user.' >&2; exit 2; }
for tool in python3 curl tar sha256sum make gcc g++ patch perl cpio unzip rsync file bc wget docker; do
  command -v "$tool" >/dev/null || { echo "Required build tool unavailable: $tool" >&2; exit 2; }
done
[[ $2 == /* && $4 == /* && -f $2 ]] || { echo 'Absolute Linux paths are required.' >&2; exit 2; }
if [[ ${MATERIAL_APPLIANCE_WORKER:-} != 1 ]]; then
  exec python3 "$here/control-appliance.py" --launch "$here/build-appliance.sh" "$2" "$4"
fi
[[ ! -e $destination/manifest.json ]] || { echo 'Output already contains a build; select a fresh output directory.' >&2; exit 2; }
mkdir -p -- "$destination"
output=$(mktemp -d /tmp/material-appliance.XXXXXXXX)
printf '%s\n' "$output" > "$destination/build-directory.txt"
echo APPLIANCE_PHASE:preparing
active_tool=python3
python3 "$here/prepare.py" "$2" "$output" "$here" "$destination"
echo APPLIANCE_PHASE:source
stage=source
version=2025.02.6
cache="${XDG_CACHE_HOME:-$HOME/.cache}/material-buildroot-appliance"
mkdir -p -- "$cache/sources"
archive="$cache/buildroot-$version.tar.xz"
expected=a49881ff3042f458e8dbff8173bf0e5c53a84e426ec58f7343eda5e6fec76d89
if [[ ! -f $archive ]] || ! echo "$expected  $archive" | sha256sum --check --status; then
  download=$(mktemp "$cache/buildroot-download.XXXXXXXX")
  active_tool=curl
  curl --fail --location --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 30 --max-time 600 "https://buildroot.org/downloads/buildroot-$version.tar.xz" --output "$download"
  echo "$expected  $download" | sha256sum --check --status || { echo 'Buildroot source checksum mismatch.' >&2; exit 1; }
  mv -- "$download" "$archive"
fi
mkdir "$output/buildroot"
active_tool=tar
tar -xJf "$archive" --strip-components=1 -C "$output/buildroot"
stage=configuring
active_tool=make
make -C "$output/buildroot" O="$output/work" BR2_DEFCONFIG="$output/appliance_defconfig" defconfig >"$output/config.log" 2>&1
active_tool=python3
python3 "$here/prepare.py" --check-config "$output" "$destination"
echo APPLIANCE_PHASE:building
stage=building
active_tool=make
make -C "$output/buildroot" O="$output/work" BR2_DL_DIR="$cache/sources" -j2 >"$output/build.log" 2>&1
echo APPLIANCE_PHASE:packaging
stage=packaging
active_tool=python3
python3 "$here/prepare.py" --manifest "$output" "$destination"
python3 "$here/prepare.py" --deliver "$output" "$destination"
echo APPLIANCE_PHASE:complete
