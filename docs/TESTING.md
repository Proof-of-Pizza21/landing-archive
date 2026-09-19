# Landing Archive testing

Results below describe specific releases and environments. The initial local
checks ran on macOS on September 6, 2026 with Node.js 24.13.0 and installed Google
Chrome; initial Linux amd64 container checks ran on GitHub Actions on September 7
with Node.js 24.13.1 and the locked Playwright browser. These are not measurements
of the user's Umbrel. Later releases used the versions stated in their sections.

## 0.1.15 — English and Italian

The interface defaults to English and offers a persistent browser-specific
language selector. Regression coverage includes live switching, reloads,
Italian-browser defaults, invalid preferences, storage unavailable, cross-tab
updates, historical system messages, and preservation of archived Italian
content, names and notes. Existing interface regressions explicitly select
Italian; the new language regression covers the English default.

On September 19, 2026, local type checks, production build, **122 automated
tests and 18 browser tests** passed with Node.js 24.20.0 and Chrome on macOS.
Settings were inspected at desktop and phone sizes. Linux container and image
publication checks are recorded separately when completed. The following
sections remain historical evidence for their respective releases.

## 0.1.14 — startup through Umbrel's proxy

On September 19, 2026, local build, type checks, 7 authentication tests and
2 targeted browser tests passed with Node.js 24.20.0. The new regression
reproduces 0.1.13 by omitting cookies from fetch: initial navigation succeeds,
the proxy redirects API requests to login and the app fails before login.

With the corrected client, the same proxy supports startup, login, private APIs,
offline HTML, screenshots and logout. Tests verify stripping the Umbrel cookie
before forwarding, rejection of cookies as app credentials, isolation between
ports, ticket revocation and no Bearer forwarding to proxy login when Umbrel's
session expires. This is a local proxy reproducing Umbrel 1.7.4 code behavior,
not an actual Umbrel installation.

The [release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35424996465)
passed **117 automated tests, 17 browser tests and Linux amd64 container checks**,
then published the same tested image:
`sha256:6042917fc9920756e8d01994152802cb7703065572b8797aa3a178197882841c`.
Manifest, metadata and availability of 24 layers were checked anonymously;
the security inventory matches the image.

No known npm vulnerabilities or image secrets were detected. System packages
retained 398 matches, 228 distinct advisories (224 CVEs), including 7 critical
and 79 high matches. No entry reported an available distribution fix at scan
time. The full inventory accompanies the release; the
[0.1.13 assessment](SECURITY-0.1.13.md) remains applicable.

## 0.1.13 — security

On September 18, local type checks, build, **117 automated tests and 16 browser
tests** passed. Added coverage includes session isolation between ports, revoked
tickets, native downloads, hostile HTML opened from disk, forged serialization
during a complete capture, embedded 8 MiB images, pathological parser/discovery
input, interrupted HTTP and restore field limits.

The [release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35367855300)
repeated these tests on Linux, tested and published the same amd64 image. Actual
containers verified browser 153.0.8010.52 pinned by URL/SHA-256, active sandbox,
no archive mount in the worker, capture, offline HTML, comparison, backup/restore,
persistence, logout and scanning after site reset.

Anonymous manifest/metadata/24-layer availability and scanner image-ID matching
were verified. Digest:
`sha256:129a5ae8db54e0061ac8ee48c462996bf2bb77ac1c033467c6c641b8fea433da`.
No known npm vulnerabilities or image secrets. System inventory: 398 matches,
228 identifiers (224 CVEs), 7 critical, 79 high, 149 medium and 163 low; none
reported a fixed distribution version at scan time. This does not mean no risk:
[assessment and limits](SECURITY-0.1.13.md). Actual-device update validation is
separate.

## 0.1.12 — loading, confirmation and history

On September 16, local build/type checks, **92 automated and 12 browser tests**
passed with Node.js 24.20.0 and Chrome on macOS. Simulations covered complete,
partial and recovered copies; missing/corrupt images, CSS backgrounds, fonts,
deferred text, new prices with missing resources, consistent spaced confirmation,
intervening errors and unstable text. Reliable references and A → B → A returns
retain dates in portable HTML and offline navigation while reusing files.

Site reset tests cover confirmation, expired previews, authentication/origin,
active backups, worker cancellation and rejection of late results. Database
migration preserves historical copies and quality states; ordinary anomalies are
bounded and do not create permanent versions. Cleanup protects first/reference/
latest/evidence/annotated copies, preserves check dates and removes only unshared
files. UI tests cover history grouping, pagination, review and reset on desktop
and phone. Version metadata is checked across app, engine and image before
publication.

These were not 48-hour monitoring tests of the user's sites or measurements of
the Umbrel device. The [Linux release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35118902075)
passed 92 automated/12 browser tests and real-container sandbox, capture,
comparison, backup/restore and reset-scan checks. The anonymously verified image
and all 23 layers match the security inventory:
`sha256:13475adf6db84a396a4bbfab286389cb35a2c349d5204d88a6987c535ecb262e`.
The historical report recorded 397 findings and 228 distinct CVEs, zero fixable
high/critical findings and zero secrets, not absence of vulnerabilities.

## 0.1.10 — updates, collection and restore

On September 14, local type checks/build and **62 automated/8 browser tests**
passed with Node.js 24.20.0. Coverage includes event filters/read state without
history loss, annotations on the exact capture, normalized tags, combined search,
result navigation, desktop/phone layouts and exported-site browsing without live
traffic.

Restore tests include valid/schema-3 backups, altered files, wrong metadata,
duplicates, foreign paths, SQL views, generated settings columns and inconsistent
references. The separate process uses SQLite's native 64 MiB limit. Authentication,
origin, confirmation/password, chunk limits, maintenance gating, cancellation and
transaction rollback after a simulated error are checked. Safety copies retain
replaced data; the current account, notes, tags and read state survive import.
Schema 4 is additive. Preparatory 0.1.9 never entered the store; it moved directly
from 0.1.8 to 0.1.10.

The [Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34868831680)
passed on September 14, including upload, isolated validation, real replacement,
annotations, safety backup and restart. Anonymous metadata and 23 layers were
verified on September 15 and matched the inventory:
`sha256:97bda6fee9ed1145ddb09d9739de52ee6ac20b63bb8478c3aa854b4bbdc455a7`.
Historical inventory: 397 findings, 228 distinct CVEs, zero secrets and zero
fixable high/critical findings. Actual-device updating remains a separate check.

## 0.1.8 — comparison, quality and landing lifecycle

On September 14, local checks/build and **53 automated/7 browser tests** passed
with Node.js 24.20.0. Added cases cover two-pixel shifts, changing height, real
visual changes, small important regions, exclusions, advertising parameters,
real variants, missing images, bounded quality retries, prices and A → B → A.

Tests verify additive schema-3 migration, preserved copies, click selection,
two-copy previews, rule access control, independent discovery cadence and path
filters. Partial sitemaps do not remove pages; two 404/410 responses and recovery
update lifecycle while keeping history. Desktop/phone screenshots were inspected;
editor frames execute neither scripts nor external requests.

The [Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34835300152)
passed September 14: sandboxed browser, real capture, 12-million-pixel comparison,
no duplicates on unchanged content, backup, restart, deletion and internal-network
protection. A migration from the real 0.1.7 schema with historical files preserved
accounts, notes and copies without duplicating an advertising-parameter-only change.

Anonymous metadata/platform/23-layer availability and inventory matching passed:
`sha256:cdf09865c06931405eec31c2162f7d42303b8c2975729e6fe651654db3fc2483`.
Historical inventory: 398 findings, 229 distinct CVEs, zero secrets and zero
fixable high/critical findings. This is not absence of vulnerabilities or proof
of complete Umbrel-device validation.

## 0.1.7 — highlighted differences

Local checks/build and **49 automated/5 browser tests** passed with Node.js
24.20.0. New cases locate two separate regions and verify alignment, one-pixel
borders, malformed input/limits, cancellation, consistency with existing detection
and historical signatures. Summaries distinguish text, metadata and URL-parameter
changes.

Browser coverage includes toggleable highlights, region navigation, synchronized
scrolling, text differences, nonvisual metadata changes and 390-pixel layout.
The authenticated API rejects cross-page comparisons, limits concurrency and does
not create archive objects/versions. Container tests cover 12-million-pixel
screenshots and the new endpoint.

The [Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34781450322)
passed September 13, including highlighted comparison in actual containers.
Anonymous metadata, 23 layers and inventory matching passed:
`sha256:ccf753e8c20d053bd8c48ebb3390955ea00be0d3d2374838cbbe213ac3271ce8`.
Historical inventory: 396 findings, 228 distinct CVEs, zero secrets and zero
fixable high/critical findings. Device validation remains separate.

## 0.1.6 — offline browsing

Preparation of 0.1.4 stopped at a Linux dependency-reference failure; no image or
store update was distributed. Version 0.1.5 passed Linux tests but publication
was still restricted to 0.1.3. Version 0.1.6 corrected both references, checked
release/package/identity/repository consistency and verified a clean lockfile install.

Local checks/build and **44 automated/4 browser tests** passed. Hostile archived
documents were opened with scripts/live traffic blocked; tests navigated different
dates, anchors, missing links, back navigation and mobile UI. Authentication,
security headers and complexity limits are covered. The
[Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34747984632)
passed September 13, including reproduced AppArmor denial and full containers
with authenticated offline browsing.

Anonymous metadata, 23 layers and inventory matching passed:
`sha256:0236c013c031198f74089db38f9a80b9473b9d782683d4ba1b1010afadd9f359`.
Historical inventory: 396 findings, 228 distinct CVEs, zero secrets and zero
fixable high/critical findings. Actual-device update validation is separate.

## 0.1.3 — September 9–10, 2026

Checks/build, **41 automated tests and 3 browser tests** passed. Cases reproduce
sandbox startup failure, verify retry and ensure arguments, URLs and secrets
stay out of user diagnostics/logs. Docker tests require AppArmor 4, deny `userns`
in a temporary profile and then verify the dedicated profile, including repeated
loading. The [Linux run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34440663040)
passed capture, offline copy, manual checks, backup, restart and deletion. The
actual worker used `landing-archive-worker` with Chromium sandbox active.

Anonymous metadata, 22 layers and inventory matching passed:
`sha256:e8cab2dd89b4f74ad251793f4328fbac98a9a7ad534e82ea185799ce76a9dfdf`.
Inventory: 392 findings, 225 distinct CVEs, 79 high/critical matches with no fix
reported by the scanner; zero secrets and zero fixable high/critical findings.
Actual-device update testing remained outstanding; the initial denial had been
confirmed by device logs.

## 0.1.2 — September 9, 2026

With Node.js 24.20.0, build, **39 automated/3 browser tests** passed. Added cases
cover manual priority, paused-site checks, restarting stuck jobs, rejecting late
results after cancellation, deleting only unshared files, export protection and
queue migration. Browser tests cover page/resource redirects, relative links from
the final URL and blocking redirects to private networks. UI was tested at
1,440 and 390 pixels, including deletion confirmation and no horizontal overflow.

One public capture reproduced `ERR_PROXY_CONNECTION_FAILED` before the fix and
then produced HTTP-200 HTML/screenshots in about 7 seconds locally. Two more
public sites also succeeded. Their URLs/copies remain excluded from the repository.

The [release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34382062197)
repeated checks on `fec5177`, tested/published Linux amd64, and verified sandbox,
authentication, private-network blocks, real capture, paused manual checks,
deduplication, backup, restart and confirmed deletion.

Anonymous manifest/metadata/21-layer availability and inventory matching passed:
`sha256:3fda9f79f7aabe03241c4b523fdef870636f839ffcaf77cd3ec87050d0823f9b`.
Inventory: 390 package findings, 223 distinct CVEs, 79 high/critical matches with
no reported fix, zero secrets and zero fixable high/critical findings. This is
not absence of vulnerabilities. Actual-device validation remained outstanding.

## 0.1.1 — September 9, 2026

The [release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34314394725)
verified/published `984ebaf` with Node.js 24.20.0 and the locked browser. Checks,
build, **31 automated tests** and browser regression passed locally and on Linux.
Coverage added encoded routes, image/metadata limits, worker responses, robots.txt
rules and interrupted-job recovery.

The distributed image repeated initial Docker checks, including two
12-million-pixel images compared in the 1 GiB web container followed by a health
check. Trivy found zero secrets and zero fixable high/critical findings, retaining
390 package findings, 223 distinct CVEs and 79 high/critical matches without a
reported fix. Native libraries still required assessment/maintenance.

On September 9, anonymous manifest/metadata/21-layer availability matched the
architecture, version, source revision and public identity. Digest:
`sha256:a411e0cd6407bccaffd35f406c4198acf9ed14a49bffc0cca7692f89b8272779`.
Device install/update validation remained outstanding.
[Introduced limits](SECURITY-0.1.1.md).

## Initial local verification

- TypeScript and production UI builds passed; 23 automated checks covered access,
  cross-origin protection, private addresses, A → A → B → A history, deduplication,
  repeated 404, recovery, notes, comparison, search and downloads.
- ZIP restored into a separate database: SQLite integrity, versions/files and
  revoked exported sessions verified.
- Persistent queue tested with a simulated engine: restart, interrupted jobs,
  pause and retry after temporary failure.
- An additional browser test verified visible text: hidden anti-spam fields,
  transparent elements, one-pixel clipping and exclusions do not change the
  signature, while visible content remains included.
- App/worker in separate processes: account created through UI, three public
  sites captured, timeline/offline copies/comparison/notes/backup used in browser.
- Two visits to the first site, after the invisible-field fix, recorded an
  unchanged check without another version.
- HTML opened with network and JavaScript disabled loaded 10/10, 18/18 and 35/35
  images respectively, with no scripts retained. Screenshots/offline copies,
  including the second site's font, were visually inspected.
- Discovery found eight addresses through sitemaps/links, within a limit of ten,
  without warnings in about twelve seconds.
- Desktop/phone UI showed no JavaScript errors or horizontal overflow.
  Package YAML and Chromium profile were statically validated.

Test credentials/data remain local and are excluded from source ZIPs/images.

## Observed limits

Real captures took approximately 14–36 seconds per page on the test computer.
The three full copies occupied about 3.7, 4.0 and 13.8 MB. These are samples, not
resource/fidelity guarantees for other sites.

Tracking requests and unavailable resources can produce saved warnings. Video,
forms and embeds are not full interactive copies. Loading has a time limit;
0.1.1 added screenshot width/height/total-pixel limits.

Each visit starts a fresh browser context. Cookies, personalization, animations
and A/B tests can yield variants without a permanent site edit. Conversion results
are not inferred. Checks fetch pages again; unchanged content avoids additional
saved versions, not all network downloads.

## Initial Linux amd64 container tests

[Run 34147293202](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34147293202)
passed on `f74053e`, using Ubuntu 22.04 for checks/build/browser regression and
then the actual amd64 image:

- Healthy app/worker as `1000:1000`, read-only roots, distributed Compose limits
  and historical read-only worker archive mount.
- Initial account setup, authenticated access, HttpOnly/SameSite Strict cookies
  and rejected duplicate setup (later releases replaced cookie sessions).
- Private addresses blocked at app/worker APIs, unauthenticated/malformed worker
  operations rejected, worker archive writes blocked by the mount.
- Chromium startup/rendering with Linux sandbox enabled.
- Real worker capture of `https://example.com/`: PNG and inert HTML, opened with
  network/JavaScript disabled.
- Second unchanged capture recorded as another check with one version retained.
- ZIP export, reopened database and file hashes verified; active sessions and
  worker token excluded.
- App/worker restart preserved version, two checks and access; logout/login passed.

Only a public example page and temporary account were used. Credentials/captures
were not uploaded as workflow artifacts. The release repeated these checks before
publishing `ghcr.io/proof-of-pizza21/landing-archive:0.1.0`.

The [0.1.0 release run](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/34149224656)
published `4cbc8e6`. Anonymous download, amd64 architecture, metadata and digest
were verified September 7:
`sha256:beb2bfd0c0c79bf632457f753fe8ee05a6bfbbc33c93719483db73e055cd3cd7`.

## Device checks and scope

The target is umbrelOS 1.7.4 on 64-bit Intel/AMD mini PCs. Runner Compose tests use
a dedicated Docker volume and do not verify installation through Umbrel's UI.
Kernel sandbox behavior, Umbrel-created/restored volume permissions, proxy access,
fresh installation, reboot, update and restoration need actual-device checks.
ARM is outside this preview. Runner resource use/timings are not estimates for
the mini PC. Later user reports do not turn automated checks into a full device
audit or endurance test.

## Repeat development checks

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:browser
```

Browser tests need Playwright Chromium or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
They use temporary data; these commands do not start public-site captures.
