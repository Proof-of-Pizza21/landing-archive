# Security update 0.1.13

On Umbrel, use **0.1.14 or later**: the [proxy fix](RELEASE-0.1.14.md)
resolves the startup failure in 0.1.13 while retaining these protections.

This update preserves accounts, settings, copies and history. Earlier sessions
are invalidated; sign in again with existing credentials. Database schema 5
is unchanged, and no automatic cleanup runs.

| Area | Change | Verification |
| --- | --- | --- |
| Browser | Chrome Headless Shell 153.0.8010.52, official download pinned by URL and SHA-256 independently of Playwright | Actual version and enabled sandbox in the Linux container |
| Sessions | Credential in `sessionStorage`, sent as Bearer only to same-origin APIs; legacy cookies no longer authorize access | Real browser with two apps on the same host and different ports |
| Files and previews | 60-second ticket bound to resource, query and session, revoked on logout; streamed downloads | Screenshots, frames, HTML and ZIP; rejection of different paths, dates, methods and sessions |
| Complex HTML | Separate process, 256 MiB heap, external 8-second deadline, one active process and two queued requests; attribute/depth preflight | 120,000 attributes, deep trees, cancellation and main-process availability |
| Active content | Final sanitation outside the site's JavaScript context and embedded CSP; same protection for historical HTML downloads, offline view and portable export | Scripts, events, refresh, SVG and hostile links |
| Discovery | Progressive tag parsing without repeatedly searching the remaining page | Nearly 3 MB of unclosed comments/scripts, with an external deadline |
| Restore | Lock waits for actual mutations without retaining requests interrupted before the handler | Aborted real HTTP, disconnected asynchronous operations and bodies completed during maintenance |
| Imported backups | Field limits checked before SQLite row materialization and JSON parsing | Oversized fields, inflated metadata and Unicode boundary values; current archive remains intact |
| Worker | Mounts only its token directory, read-only; no database, captures or backups | Startup without archive directory, token migration and rotation |

Resource delivery to capture code also has an aggregate budget, including cache
hits, and at most four simultaneous operations. HTML over 32 MiB or excessive
structural complexity is rejected without changing saved copies. Full backups
retain original objects for restoration; viewing and downloading HTML applies
sanitation again.

The image gate blocks advisories with an available fix and unclassified severity,
as well as fixable high/critical advisories. Counts distinguish CVEs from other
advisories. A package scanner cannot establish browser safety, so the executable
version is checked explicitly.

## Remaining limitations

- HTTP does not encrypt traffic. Use a trusted LAN, VPN or separately managed
  HTTPS proxy. Replacing session cookies removes their Secure-flag problem;
  it does not add TLS.
- Browsers and libraries need regular maintenance. Passing tests is neither a
  guarantee of no vulnerabilities nor a penetration test of the actual Umbrel.
- Very large per-page version lists still need pagination; check logs already
  have it. No additional crash from that case was reproduced.
- Process limits reduce the impact of complex content. A compromised web service
  would still have access to its archive. Keep backups on another device.
- Sandbox compatibility depends on the device kernel and configuration.
  Restrictions are not disabled after failure; the engine reports startup errors.

Browser references: [Chrome for Testing feed](https://googlechromelabs.github.io/chrome-for-testing/),
[Chrome security updates](https://chromereleases.googleblog.com/),
[Playwright browsers](https://playwright.dev/docs/browsers).

[TESTING.md](TESTING.md) records results. The
[release workflow](https://github.com/Proof-of-Pizza21/landing-archive/actions/runs/35367855300)
passed Linux checks on September 18, 2026. The store pins the tested image;
its manifest, metadata and availability of all 24 layers were checked without
GitHub credentials.

## Image inventory and remaining advisories

The scan recorded 398 package/advisory matches and 228 distinct identifiers
(224 CVEs): 7 CRITICAL, 79 HIGH, 149 MEDIUM and 163 LOW. No entry reported a fixed
version for the installed distribution packages at scan time. These counts do
not represent proven exploitable paths in the app; none were suppressed. The
complete JSON report accompanies the release.

The seven critical matches need these distinctions:

- **zlib / CVE-2023-45853:** Debian states that the affected MiniZip component is
  not built by Bookworm's zlib package. This finding does not demonstrate a flaw
  in the installed zlib library. [Debian record](https://security-tracker.debian.org/tracker/CVE-2023-45853).
- **SQLite / CVE-2025-7458:** concerns specific SQL queries in library versions
  3.39.2–3.41.1. The app uses Node's bundled `node:sqlite`, not the flagged system
  library; APIs do not execute user-supplied SQL, and backups are checked in a
  separate process. The installed-package advisory remains recorded.
  [Debian record](https://security-tracker.debian.org/tracker/CVE-2025-7458).
- **GLib / CVE-2026-58016:** concerns D-Bus introspection XML parsing. The container
  does not mount the host bus; no path from a remote page to the vulnerable
  function was demonstrated. The advisory is not declared fixed.
  [Debian record](https://security-tracker.debian.org/tracker/CVE-2026-58016).
- **libxml2 / CVE-2026-6653:** remains an availability advisory in the native parser.
  Sitemap parsing uses `fast-xml-parser` and rejects DTDs/entities; this does not
  prove every native use by dependencies is unreachable.
  [Debian record](https://security-tracker.debian.org/tracker/CVE-2026-6653).
- **Perl / CVE-2026-13221, CVE-2026-42496, CVE-2026-8376:** application code invokes
  neither Perl nor Archive::Tar. The third concerns 32-bit builds, while the
  distributed image is amd64. These remain in the scan.
  [Regex](https://security-tracker.debian.org/tracker/CVE-2026-13221),
  [Archive::Tar](https://security-tracker.debian.org/tracker/CVE-2026-42496),
  [32-bit builds](https://security-tracker.debian.org/tracker/CVE-2026-8376).

Moving to a newer system base and reducing runtime packages are separate
maintenance work requiring fresh validation, especially of sandboxes. No reported
patch does not mean no risk. Formal unreachability is not claimed for GLib or
libxml2.
