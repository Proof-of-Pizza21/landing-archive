# Security and limits in 0.1.1

Version 0.1.1 strengthened API access, handling of unusual pages, robots.txt
discovery and distributed component updates. It preserved the database schema
and earlier captures. This document describes that historical release; subsequent
changes, including browser pinning, are in [0.1.13](SECURITY-0.1.13.md).

## Access

Routes are private by default. Authentication follows the route recognized by
the server, including differently encoded addresses. Only the login page/assets,
authentication status, initial account setup and login remain public. API
responses must not be cached.

## Capture limits

- Screenshots: maximum width 1,920 pixels, height 20,000, and 12 million pixels
  total. At the normal width of 1,440, maximum height is 8,333. Cropping is decided
  outside site code and generates a warning; HTML may preserve content below it.
- PNG: at most 16 MiB compressed, 8-bit RGB/RGBA, non-interlaced. Dimensions and
  structure are checked before decoding.
- Visual comparison: separate temporary process, 128 MiB JavaScript heap and a
  coordinator-enforced 5-second deadline. Native buffers are bounded by permitted
  image sizes; 128 MiB is not a total process-memory ceiling.
- HTML: 32 MiB maximum. Metadata: 8 MiB serialized, 1.5 million text characters,
  100 headings of 500 characters, 2,000 links and 500 image URLs, with field limits.
- Worker response: at most 64 MiB actually read, even with an incorrect declared
  length. This check precedes complete JSON reading; fields are validated before
  storage.

Metadata is extracted in a browser environment isolated from site modifications
to standard JavaScript functions. Exceeding a limit fails the check without
removing earlier copies. Permanent format/size errors are not retried immediately.
If restart recovery finds an interrupted job with three attempts already used,
the site is paused and can be resumed from settings.

Older screenshots beyond the new limits remain downloadable. Comparison avoids
decoding them and establishes a new reference version.

## Page discovery

robots.txt rules are matched without backtracking regular expressions. Literal
segments advance through the path using KMP. Files are limited to 128 KiB,
256 total rules and 512 characters per rule, with a total matching-work budget
per discovery. Excessive rules stop discovery with a visible error rather than
being ignored and allowing further requests.

## Components and image verification

The base is Node 24.20.0 LTS, pinned to the official digest verified on September
8, 2026. The build applies available Debian updates and removes npm/Yarn from
the runtime after installation. In this historical release, Playwright's locked
version selected the browser.

GitHub verifies the Trivy checksum and scans the freshly built image. Fixable
high/critical vulnerabilities block publication, as do detected secrets. Secret
values are not printed or uploaded as artifacts. The vulnerability inventory is
retained, including findings without a fix.

A library CVE does not automatically prove its vulnerable path is used by the
app. Remaining findings need assessment and maintenance; digest pinning prevents
automatic updates. The pipeline also runs real captures and comparisons under
the distributed container limits.

Regressions cover real HTTP with equivalent routes, oversized or malformed worker
responses, out-of-bounds images, complex robots rules, queue recovery, visual
comparison and browser metadata. Container tests compare 12-million-pixel images
under the web service's memory limit.
