#!/bin/sh
# Guest-only init. Never formats a disk or changes the build host.
set -eu
config=/opt/material/runtime.json
value() { jq -r "$1" "$config"; }
case "${1:-}" in
  start) ;;
  stop) exit 0 ;;
  *) echo 'Usage: init-script start|stop' >&2; exit 2 ;;
esac
if [ "$(basename "$0")" = S59material-storage ]; then
  mkdir -p /data
  if [ "$(value .persistence)" = true ]; then
    device=$(blkid -L MATERIAL_DATA || true)
    if [ -z "$device" ]; then
      echo 'Persistent data disk labelled MATERIAL_DATA is required. No disk was formatted.' >&2
      exit 1
    fi
    mount -o nosuid,nodev "$device" /data
    chmod 700 /data
  else
    mount -t tmpfs -o mode=0700 tmpfs /data
  fi
  mkdir -p /data/docker /data/config /data/tunnel
  exit 0
fi
mountpoint -q /data || { echo 'Workload stopped: data storage is not mounted.' >&2; exit 1; }
attempt=0
until docker info >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -le 60 ] || { echo 'Container engine startup timed out.' >&2; exit 1; }
  sleep 1
done
# The workload images are a file on the boot medium, checked against the hash this build
# recorded inside the initramfs before anything is loaded.
media=/run/material-media
mkdir -p "$media"
found=false
attempt=0
while [ "$found" = false ] && [ "$attempt" -lt 30 ]; do
  attempt=$((attempt + 1))
  for device in /dev/sr* /dev/vd* /dev/sd*; do
    [ -b "$device" ] || continue
    if mount -t iso9660 -o ro "$device" "$media" 2>/dev/null; then
      if [ -f "$media$(value .images.path)" ]; then found=true; break; fi
      umount "$media"
    fi
  done
  [ "$found" = true ] || sleep 1
done
[ "$found" = true ] || { echo 'Workload stopped: the boot medium with the workload images was not found.' >&2; exit 1; }
if [ "$(sha256sum "$media$(value .images.path)" | cut -d' ' -f1)" != "$(value .images.sha256)" ]; then
  umount "$media"
  echo 'Workload stopped: the image archive on the boot medium does not match this build.' >&2
  exit 1
fi
docker load --input "$media$(value .images.path)" >/dev/null
umount "$media"
compose() {
  if [ -f /data/workload/runtime.env ]; then
    docker compose --project-name material-appliance --env-file /data/workload/runtime.env -f /opt/material/compose.json "$@"
  else
    docker compose --project-name material-appliance -f /opt/material/compose.json "$@"
  fi
}
if [ "$(value .compose)" = true ]; then
  python3 /opt/material/runtime-setup.py
  compose up -d --pull never --no-build
else
  # Host networking supports LAN discovery, including Home Assistant containers.
  if docker container inspect material-workload >/dev/null 2>&1; then
    expected_image=$(docker image inspect --format '{{.Id}}' "$(value .image)")
    installed_image=$(docker container inspect --format '{{.Image}}' material-workload)
    if [ "$expected_image" != "$installed_image" ]; then
      echo 'Existing workload belongs to a different image. Data and container preserved; explicit supported upgrade required.' >&2
      exit 1
    fi
    docker start material-workload >/dev/null
  elif [ -f /opt/material/personal-vocabulary.json ]; then
    docker run -d --name material-workload --restart unless-stopped --pull never --network host \
      --mount type=bind,src=/data/config,dst=/config \
      --mount type=bind,src=/opt/material/personal-vocabulary.json,dst=/run/material/personal-vocabulary.json,readonly \
      --env PERSONAL_VOCABULARY_FILE=/run/material/personal-vocabulary.json "$(value .image)"
  else
    docker run -d --name material-workload --restart unless-stopped --pull never --network host \
      --mount type=bind,src=/data/config,dst=/config "$(value .image)"
  fi
fi
# Only the authenticated guest portal may activate a tunnel. Boot never publishes it.
if [ "$(value .mode)" = kiosk ]; then
  export XDG_RUNTIME_DIR=/run/material-kiosk
  mkdir -p "$XDG_RUNTIME_DIR"
  chmod 700 "$XDG_RUNTIME_DIR"
  weston --backend=drm-backend.so --shell=kiosk-shell.so --socket=wayland-0 >/data/weston.log 2>&1 &
  export WAYLAND_DISPLAY=wayland-0
  attempt=0
  until [ -S "$XDG_RUNTIME_DIR/wayland-0" ]; do
    attempt=$((attempt + 1))
    [ "$attempt" -le 30 ] || { echo 'Kiosk compositor startup timed out.' >&2; exit 1; }
    sleep 1
  done
  browser_url=$(value .kioskUrl)
  if [ -f /opt/material/guest/server.py ]; then
    browser_url=http://127.0.0.1:8766/
  fi
  cog --platform=wl "$browser_url" >/data/browser.log 2>&1 &
fi
if [ -f /opt/material/guest/server.py ]; then
  python3 /opt/material/guest/server.py >/data/guest-portal.log 2>&1 &
fi
if [ "$(value .compose)" = true ]; then
  ids=$(compose ps -q)
else
  ids=material-workload
fi
[ -n "$ids" ] || { echo 'No running workload containers.' >&2; exit 1; }
for container in $ids; do
  [ "$(docker inspect --format '{{.State.Running}}' "$container")" = true ] || { echo 'Workload container is not running.' >&2; exit 1; }
done
echo 'MATERIAL_APPLIANCE_WORKLOAD_STARTED'
attempt=0
while [ "$attempt" -lt 90 ]; do
  attempt=$((attempt + 1))
  healthy=true
  if [ -n "$(value .kioskUrl)" ]; then
    curl --fail --silent --max-time 5 "$(value .kioskUrl)" >/dev/null || healthy=false
  else
    for container in $ids; do
      [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unavailable{{end}}' "$container")" = healthy ] || healthy=false
    done
  fi
  if [ "$healthy" = true ]; then
    echo 'MATERIAL_APPLIANCE_WORKLOAD_HEALTHY'
    exit 0
  fi
  sleep 2
done
echo 'Workload started, but endpoint or container health is unverified.' >&2
exit 1
