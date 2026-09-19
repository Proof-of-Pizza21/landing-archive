# Third-party components

Landing Archive uses open-source components without incorporating ArchiveBox or
changedetection.io code. Exact versions are pinned in `package-lock.json`.
Transitive dependencies retain their licenses and attributions in distributed
packages.

| Component | Declared license | Source |
| --- | --- | --- |
| Playwright 1.63.0 | Apache-2.0 | https://github.com/microsoft/playwright |
| SingleFile Core 1.5.121 | AGPL-3.0-or-later | https://github.com/gildas-lormeau/single-file-core |
| Fastify and official plugins | MIT | https://github.com/fastify |
| React e React DOM | MIT | https://github.com/facebook/react |
| Vite | MIT | https://github.com/vitejs/vite |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| esbuild | MIT | https://github.com/evanw/esbuild |
| Lucide | ISC | https://github.com/lucide-icons/lucide |
| diff | BSD-3-Clause | https://github.com/kpdecker/jsdiff |
| pixelmatch | ISC | https://github.com/mapbox/pixelmatch |
| pngjs | MIT | https://github.com/pngjs/pngjs |
| parse5 8.0.1 | MIT | https://github.com/inikulin/parse5 |
| fast-xml-parser | MIT | https://github.com/NaturalIntelligence/fast-xml-parser |
| archiver | MIT | https://github.com/archiverjs/node-archiver |
| yauzl 3.4.0 | MIT | https://github.com/thejoshwolfe/yauzl |

The Linux browser is Chrome Headless Shell 153.0.8010.52 from
[Chrome for Testing](https://github.com/GoogleChromeLabs/chrome-for-testing).
Its URL and SHA-256 are pinned in `scripts/browser-release.json`, separately
from Playwright. The distribution retains `ABOUT` and `LICENSE.headless_shell`,
including Chromium/component attributions, in
`/opt/landing-browser/chrome-headless-shell-linux64`.

Node.js and Chromium also include their component licenses and attributions.
The Linux image retains system-package copyright documents. The build does not
remove runtime dependency license files.

## seccomp profile

`umbrel-community-store/proof-of-pizza21-landing-archive/seccomp-profile.json.template`
is derived from
https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json.
The Apache 2.0 license with the original project's Microsoft and Google
attributions is distributed alongside the profile as `LICENSE-PLAYWRIGHT`.

Landing Archive changes are identified in JSON comments: `clone3` returns ENOSYS;
`close_range`, `epoll_pwait2` and `faccessat2` are allowed for modern runtime
compatibility, consistent with corresponding rules in the current Docker profile.
The `chroot` rule is not conditional on the container's initial capabilities:
Chromium uses it to relinquish filesystem access after entering its user namespace.
The kernel still checks namespace privileges, and the container retains
`cap_drop: [ALL]`. Chromium source reference:
https://chromium.googlesource.com/chromium/src/sandbox/+/refs/heads/main/linux/services/credentials.cc.
Remaining rules derive from the referenced Playwright file.

## AppArmor profile

The dedicated worker profile derives from `apparmor/template.go` in
[Moby Profiles apparmor/v0.2.0](https://github.com/moby/profiles/blob/apparmor/v0.2.0/apparmor/template.go),
licensed Apache-2.0, copyright The Moby Authors. Its license is distributed in
`umbrel-community-store/proof-of-pizza21-landing-archive/hooks/LICENSE-MOBY`.
Changes are identified in the template: dedicated name, ABI 4, explicit `userns`
and `unix` permissions. The hook keeps an ABI 3 variant for older parsers. Moby's
deny rules are retained.

## Corresponding source

Original Landing Archive code is available under AGPL-3.0-or-later. The image
includes application source in `/app/source`, the lockfile, packaging and build
instructions. Authenticated users can download a source ZIP through `/api/source`
from the interface's source link. Before release, verify that it corresponds to
the distributed executable and includes what is needed to rebuild it. Also
publish corresponding source with the release and retain component licenses.
This document does not replace a source offer or individual license obligations.

User-archived documents and images are not distributed with the app and remain
the property of their respective rights holders.
