# Build Home Assistant OS and container images from an external tree

Some projects ship their own Buildroot tree instead of a defconfig for stock Buildroot. Home Assistant OS, and the Home Assistant Material fork of it, keep an `operating-system/` folder with a vendored `buildroot/`, a `buildroot-external/` tree with one defconfig per board, a `Makefile` and a `Dockerfile` for the builder container. Material Buildroot builds those images with the project's own recipe instead of reinterpreting it.

## Where it is

**Builds → Operating system and container images.**

1. **Choose repository.** Pick the repository root (or the `operating-system` folder itself). The panel lists the boards the tree defines, such as `ova`, `rpi5_64` and `generic_x86_64`, and says whether the repository also carries the Home Assistant Material container recipe.
2. **Choose output folder.** Finished images, `build.log` and `receipt.json` go into a new subfolder here. The default is the application's own `os-images` folder.
3. **Board → Build operating system image.** Starts one build. The log streams into the panel, and **Cancel build** stops it.
4. **Build container image locally** builds `home-assistant-material:local` from the same repository.

Only one build runs at a time. The panel never accepts a command: the board must be one the tree lists, and folders come from the native folder picker.

## What happens during an operating system build

| Step | What it does |
| --- | --- |
| Builder image | `docker build` of the tree's own `Dockerfile`. The build context is a `git archive` of the committed tree, so the builder matches the source exactly. |
| Build volume | A Docker volume holds the source and output. Buildroot runs on a Linux filesystem, which keeps symbolic links and case-sensitive names intact and is much faster than a Windows bind mount. |
| Source export | The committed tree is piped in with `git archive`, using the committed bytes with no line-ending conversion, then owned by the unprivileged builder user (UID 1000). |
| Image build | `make <board>` in the tree's builder, the same command its own `build.sh` and release workflow use. The container is privileged because the tree's recipe runs its own Docker daemon to fetch the Supervisor and add-on containers; Buildroot itself runs as the builder user, not as root. |
| Collect | `haos_*` files are copied to the output folder, and each one's size and SHA-256 are written to `receipt.json`. |
| Cleanup | The per-build volume and builder tag are removed. A shared compiler and download cache volume (`material-buildroot-haos-cache`) is kept so later builds are faster. |

The source repository is only read. Nothing is written to its working tree.

### Images built from source

An operating system image holds the containers it starts on first boot: the Supervisor, the landing page that stands in for Home Assistant Core until the real core is installed, and the DNS, Audio, CLI, Multicast and Observer plug-ins. The tree's recipe normally downloads all of them with `skopeo` during `make`.

When the repository also carries the sources of some of those images, Material Buildroot builds them from the same commit and puts those into the OS image instead. For Home Assistant Material that means `supervisor/` and `landingpage/`. The steps, before `make`:

1. Read the tree's own update feed for the board's channel (or the `--version-json` file) once, so the images and the build agree on versions.
2. Start a private registry container (`registry:3.0.0`, pinned by digest) on a Docker network that exists only for this build. It publishes no port on this computer.
3. Build each image from a `git archive` of its committed folder, with the board's platform and the version from the feed (for example `BUILD_VERSION=2026.11.0.132` for the Supervisor), under a build-only tag so a published image of the same name on this computer is never shadowed.
4. Copy each image into the private registry with `skopeo`, run in the tree's builder image on the build network, under the exact name the feed gives (for example `ghcr.io/ding-ding-projects/amd64-hassio-supervisor`), and record the stored digest.
5. Give the builder user a `registries.conf` that redirects only the repository's own registry prefix to the private registry, and run `make` on the build network.

The tree's recipe then fetches those names as usual and gets the images built from source. It prints the digest of every image it puts into the OS image, and the build only succeeds when each image built from source appears there with the digest that was stored. The receipt lists the images built from source with their digests and the commit, and the images that were still downloaded. Afterwards the registry, the network and the build-only tags are removed.

Images whose sources are not in the repository (the upstream plug-ins) are downloaded by the tree's recipe as before, and the receipt says so. After the first boot, Home Assistant Core itself is installed by the Supervisor from the update feed, as on any Home Assistant OS system; it is not part of the image. `--no-from-source` on the command line keeps the tree's own downloads for everything.

### Version feed and signing

Without a pinned version file, the tree fetches its channel's live version feed (for Home Assistant Material, the public `channel/stable.json`). The command-line route accepts `--version-json` to pin exact container versions, as the release workflow does.

Update bundles are signed with the release key only when the tree's release key and certificate are provided. A local build otherwise gets a one-time key, so its update bundles will not install over a released system. The receipt states this.

## Container image build

This follows the repository's `build.sh`:

1. Builds the frontend wheel (`build/frontend.Dockerfile`).
2. Copies the integration translations from the upstream image for the pinned core (`build/translations.Dockerfile`).
3. Builds `core/Dockerfile` on the pinned base image.

The repository is staged with a `--shared` clone, so its working tree is not touched. The result is a local image only; nothing is pushed.

## Bootable appliance ISO

The appliance route (Images, **Standalone OS**, **Build a container image from source**) also accepts this repository as one source. It recognizes the layout from the tracked files: Core in `core/` (project `homeassistant`), the Material frontend in `frontend/` (pnpm and gulp), and the upstream versions in `versions.json`. No second frontend repository is asked for; the frontend revision is the repository's own revision.

Preparation takes a snapshot of the selected revision and copies only `core/` and `frontend/` into the build, leaving out symbolic links (agent notes) and listing them in the source receipt. It then builds one image with the same stages as the container image build above: the frontend wheel, the integration translations of the matching upstream release, and `core/Dockerfile` on the base image named in `versions.json`. The image is labelled with the revision, and the ISO producer checks that label before it embeds the image. The appliance runs it with host networking and a persistent `/config` volume on port 8123, with the repository's own health check (`/manifest.json`), so the console appliance can report when Home Assistant answers. The image travels on the ISO as a separate file checked by hash at boot, because it is too large to go inside the initramfs.

Still downloaded: the upstream base image and the upstream Core image the translations are taken from. This is Home Assistant Core in a container; the appliance has no Supervisor and no add-on store.

## Command line

The same route runs without the window:

```powershell
node scripts/haos/build-haos.cjs --source <repository> --defconfig ova --output <folder> [--commit HEAD] [--version-json <file>] [--no-from-source] [--keep-volume]
node scripts/haos/build-container-image.cjs --source <repository> --work <folder> [--tag home-assistant-material:local] [--save <file.tar>]
```

Press Ctrl+C to cancel; cleanup still runs.

## Requirements and limits

- A Linux Docker engine (Docker Desktop with WSL 2 works) with tens of gigabytes free. A first build of one board takes one to two hours.
- The board builds for its own architecture: ARM boards cross-compile in the same builder.
- Flashing a board and installing over the air are separate steps and are not part of this route.

## Verification

See the [verification record](../evidence/external-tree-images/README.md) for the builds actually run, with hashes and the boot check.
