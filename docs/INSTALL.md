# Installation

Landing Archive is a preview for 64-bit Intel/AMD mini PCs (`linux/amd64`),
targeting umbrelOS 1.7.4. ARM is not included. Automated Linux container tests
and checks on a particular Umbrel device are separate; see [Testing](TESTING.md)
for version-specific results and the [community store](https://github.com/Proof-of-Pizza21/umbrel-community-store)
for the currently distributed, digest-pinned image.

## Install on Umbrel

1. Open community app store management in the Umbrel App Store.
2. Add [the store repository](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Open **Landing Archive Community Store** and install **Landing Archive**.
4. Launch it and create a username and password of at least **12 characters**.
5. Add a domain or page URL and choose a check interval. After its first capture,
   open the page to browse its timeline, screenshot and HTML copy.

There are no default credentials. The archive account is separate from Umbrel's
login; both protect access. Captures are stored on your device. Start with one
site and check its first copy before adding more.

In 0.1.15, English is the default. **Settings → Language** selects English or
Italian; a selector is also available before login. The choice is stored for
this browser and origin, independently of other devices. It does not translate
website content or change how the worker visits sites.

Source is in [Landing Archive](https://github.com/Proof-of-Pizza21/landing-archive).
For backups, disk space and ongoing use, see [Operations](OPERATIONS.md).

## Update an existing installation

Download a backup first, then update through Umbrel **without uninstalling**.
Reopen the app and check that the sidebar and engine report the expected
version. Version 0.1.15 retains schema 5, accounts, settings, copies and history;
only the presentation language changes. Switching from pre-0.1.13 releases
requires signing in again with existing credentials because old sessions are
invalidated. Use 0.1.14 or later for the [authenticated proxy fix](RELEASE-0.1.14.md).

Historical migrations were additive: 0.1.8 introduced schema 3 for rules,
quality and discovery, 0.1.10 introduced schema 4 for research/restore, and
0.1.12 introduced schema 5 for reliable references and observations. They did
not delete or reclassify older captures. Downgrading across a schema change
requires an earlier compatible backup; for example, returning from 0.1.8 to
0.1.7 requires a pre-migration backup.

**Areas to monitor** selects excluded and important regions. **Landing page
lifecycle** follows discoveries and disappearances. Discovery has its own
schedule in site settings. Open a version and choose **Compare** to inspect
highlighted appearance changes, text, links and image metadata. **Offline page**
opens the saved document. See [monitoring](RELEASE-0.1.8.md),
[comparison](RELEASE-0.1.7.md) and [offline browsing](RELEASE-0.1.6.md).

**Check and download now** works while a site is paused. It becomes **Restart
check** when a visit is running. **Delete site** requires confirmation and is
permanent; see [manual checks and deletion](RELEASE-0.1.2.md). Screenshot and
other [security limits](SECURITY-0.1.1.md) remain in effect.

## Backup and restore from the interface

Since 0.1.10, **Backup and restore** downloads a complete backup or uploads one
for verification. Verification does not change history. Replacement requires
confirmation and the current password, and retains a safety copy. Guided restore
keeps the current account and pauses sites. A browsable per-site ZIP is a separate
format and cannot replace the full backup. [Procedure and limits](RELEASE-0.1.10.md).

## Local Docker test

Requires Docker Engine or Docker Desktop with Compose. No separate database or
browser service is needed. On Linux with AppArmor enabled, first load the worker
profile (Umbrel does this automatically through its hook):

```sh
sudo bash umbrel-community-store/proof-of-pizza21-landing-archive/hooks/pre-start
```

Start from the project directory:

```sh
docker compose config
docker compose up --build -d
docker compose ps
```

Open `http://localhost:4310`, create your account and add a site. No password is
included in the manifest. The app generates persistent secrets at first startup;
the worker waits for it and reads its internal token from a dedicated read-only
directory. Only the web service mounts the archive volume.

The first build downloads Chromium and system libraries, excluding local test
URLs and captures. If browser isolation cannot start, capture must fail: do not
add `--no-sandbox`, administrator privileges or a Docker socket to bypass the
failure. Check the kernel and security profiles.

The local port binds only to `127.0.0.1`, preventing a development instance from
exposing initial setup to the LAN. On Umbrel, use the package with `app_proxy`.
Stop while preserving data with `docker compose stop`; resume with
`docker compose up -d`. The named `archive` volume holds the database, secrets
and captures. `docker compose down` retains it; adding `--volumes` deletes it and
destroys the data. Do not use that as an update procedure.

## Development without containers

Use Node.js 24.20.0 or later in the 24.x line, npm and Chromium's system libraries:

```sh
npm ci
npx playwright install chromium
npm run build
```

On a dedicated Linux development machine, `npx playwright install --with-deps
chromium` installs missing libraries. Do not modify Umbrel's host OS for this
mode; the Docker image contains its dependencies. Release validation uses the
checksum-pinned browser installed by `scripts/install-browser.mjs`, with its path
in `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Run app and worker in two terminals with separate ports and the same local data
location. This mode is for development, not a replacement for packaged services.

| Variable | Service | Package value |
| --- | --- | --- |
| `HOST` | Both | `0.0.0.0` in containers; use `127.0.0.1` for development |
| `PORT` | App | `4310` |
| `PORT` | Worker | `4311` |
| `DATA_DIR` | App | `/data`; archive directory |
| `WORKER_TOKEN_FILE` | Both | `/run/landing-archive/worker-token`; dedicated mount, read-only in the worker |
| `CAPTURE_WORKER_URL` | App | `http://worker:4311` in local Compose |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Worker | Pinned executable in the image; optional override in development |
| `MIN_FREE_GIB` | App | `5`; emergency free-space reserve in GiB |

## Umbrel community-store package

`umbrel-community-store/` mirrors the dedicated store repository. Store ID
`proof-of-pizza21` and app ID `proof-of-pizza21-landing-archive` must remain stable
once installed. It follows the [official template](https://github.com/getumbrel/umbrel-community-app-store)
and [packaging guidance](https://github.com/getumbrel/umbrel-apps/blob/master/.claude/skills/umbrel-package-app/SKILL.md).

- `app_proxy` serves the interface with Umbrel authentication enabled.
- App and worker are separate services running as `1000:1000`.
- Archive data is in `${APP_DATA_DIR}/data`; the token directory is separate.
- The worker exposes no host port and authenticates internal operations.
- No Docker socket, host network, devices or additional capabilities are required.
- The worker uses seccomp/AppArmor and 512 MB of private shared memory; host IPC
  is not shared.

Umbrel renders `seccomp-profile.json.template` into `seccomp-profile.json` before
startup, including after updates, avoiding stale installed profiles. There are
no substitution variables. Local Compose reads the already-valid JSON template
directly. The dedicated AppArmor profile is loaded by `hooks/pre-start`.

Both services pin the same verified digest from
`ghcr.io/proof-of-pizza21/landing-archive`. Use the store Compose file as the
current source of truth. The intended external port is `4310`; check conflicts
on the device. Repository, support and icon URLs must remain public and valid.
The original SVG icon is in `assets/icon.svg`.

## Publication procedure

1. Run type checks, tests and build, recording actual results and distinguishing
   local tests from Umbrel validation.
2. Build and test both containers on Linux amd64, including sandbox startup,
   real capture and offline browsing. GitHub Actions can do this without Docker
   on the development machine. Publish only after success using the workflow's
   `packages: write` permission.
3. Keep the preview qualification until installation, proxy access, stop, reboot,
   update and backup restore have been tested on umbrelOS 1.7.4. Record its kernel
   and measured resource use.
4. Before commit/tag/publication, verify local Git identity, effective author and
   committer, and authenticated GitHub account. Use only `Proof-of-Pizza21` and
   `259956083+Proof-of-Pizza21@users.noreply.github.com`.
5. Check distributed files, diffs and metadata for personal test URLs, captures,
   credentials, obsolete identities and machine paths. Include licenses and
   corresponding source.
6. Verify anonymous image download and pin the published digest in store Compose.
   ARM and a multiarchitecture index require separate builds and tests.
7. Check real manifest URLs, publish the store root and test installation through
   Umbrel's interface.

## Recorded packaging checks

On September 8, 2026, the [Docker Hub API](https://hub.docker.com/v2/repositories/library/node/tags/24.20.0-bookworm-slim)
confirmed active amd64/arm64 base images for `node:24.20.0-bookworm-slim`, index
`sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`.
The Dockerfile pins it. The browser is separately pinned in
`scripts/browser-release.json` and checked by SHA-256 with the locked Playwright.
Supporting both base architectures does not imply an ARM app release.

Compose/manifest YAML, seccomp JSON, ports, health endpoints and users were
validated. The [0.1.8 Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34835300152)
used read-only roots, a non-root user, a read-only worker volume and active
Chromium sandbox. It covered capture, offline copies, forced checks during pause,
deduplication, backup, restart persistence and confirmed deletion. That historical
image was `sha256:cdf09865c06931405eec31c2162f7d42303b8c2975729e6fe651654db3fc2483`;
anonymous download was verified. Later results are in [Testing](TESTING.md).

Runner tests use local Compose and a dedicated volume. They do not reproduce
Umbrel package installation, its actual kernel, restored volume permissions,
resource use or complete install/update lifecycle.
