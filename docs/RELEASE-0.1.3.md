# Browser startup on Umbrel — 0.1.3

Version 0.1.3 fixes an incompatibility between Chromium's sandbox and the
container's default AppArmor profile on some recent systems. The system denied
`userns_create` under `docker-default`; Chromium exited with `Permission denied`
before visiting the page.

## Fix

The worker uses the dedicated `landing-archive-worker` AppArmor profile, derived
from the [Moby profile](https://github.com/moby/profiles/blob/apparmor/v0.2.0/apparmor/template.go).
The `userns` rule lets Chromium create its sandbox without administrator
privileges. Restrictions on mounts and sensitive kernel areas remain, along
with the base profile's signal and ptrace rules. With ABI 4, internal Unix
communication is also explicitly allowed; earlier ABIs included it in the
network rule.

The `hooks/pre-start` hook loads the profile into the kernel before the container
starts. Umbrel 1.7.4 runs this hook during installation, updates, and startup,
including after a device reboot. The `hooks` directory and `.template` files are
copied during updates:
[official procedure](https://github.com/getumbrel/umbrel/blob/1.7.4/packages/umbreld/source/modules/apps/legacy-compat/app-script).

Only the profile with this name is loaded. Global settings, files under `/etc`,
and the `docker-default` profile are not changed. The web service continues to
use the default profile. Browser and worker retain the Chromium sandbox,
seccomp, user `1000:1000`, a read-only filesystem, resource limits, and no added
capabilities.

For AppArmor parsers older than version 4, the hook uses ABI 3 and omits the
`userns` rule, which was not separately mediated then. If AppArmor is enabled but
the profile cannot be loaded, the container must not start unprotected. There is
no fallback to `unconfined` or `--no-sandbox`.

## Diagnostics

The app distinguishes sandbox denial, a missing browser, and a startup timeout.
The worker logs a `browser_startup_failed` event with an error code, problem
category, architecture, and kernel. Launch arguments, site URLs, credentials,
and temporary paths are not copied into the message or log. Browser startup and
page preparation are separate stages.

## Update

Export a backup and update the existing installation through the community
store. Account, archive, and database schema remain unchanged from 0.1.2.
Reopen the app, check for **0.1.3** in the sidebar, and select **Check and download
now**. Restarting only the container does not load a new profile: start or
restart the app through Umbrel's interface.

## Verification

The Docker checks run on an AppArmor 4 host. A negative test explicitly denies
`userns` and requires the capture to return `BROWSER_SANDBOX_DENIED`. The shipped
profile is then loaded twice to verify reuse and tested with browser startup,
a real capture, backup, restart, and manual controls. Results are recorded after
the checks complete; device validation remains separate from runner testing.
