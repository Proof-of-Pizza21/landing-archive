# Archive operations

## Language

From 0.1.15, choose **Settings → Language → English / Italiano**. English is the
default, even in a browser configured for another language. The preference is
saved in this browser's local storage and applies immediately; clearing site
data resets it. Separate browsers/devices choose independently. Archived pages,
titles, site names and notes remain in their original language. Capture locale,
comparison rules, schedules and history do not change. Export navigation and
repository documentation are in English.

## Frequency and page discovery

Start with page checks every 6 hours and discovery every 24 hours, increasing
frequency only for frequently changing landing pages. Visits are serial: a large
queue may take longer than the nominal interval. Six-hour checks cannot capture
a page published and removed between visits.

Sitemaps and public links find many pages, but may miss ad-only landing pages.
Add addresses from newsletters, social media or ad libraries manually. Do not
attempt to guess private directories or bypass access restrictions.

Temporary failure does not prove disappearance. Repeated 404/410 responses are
distinct from timeouts, 5xx, CAPTCHA and anti-bot blocks. A redirect can indicate
a new address or a replacement campaign.

Since 0.1.8, discovery has a separate interval in site settings. Included/excluded
paths affect newly discovered addresses; archived and manually added pages remain
monitored. **Landing page lifecycle** distinguishes new pages, changes, confirmed
disappearances, returns and absence from sitemaps. The last requires two complete
readings of the same sitemap sources: errors, truncation or source changes do
not establish disappearance.

## What a version contains

Since 0.1.6, **Offline page** opens HTML inside the app. Links lead to same-site
copies with their address/date displayed; missing copies produce a notice.
The timeline date remains the reference, and a later copy is explicitly marked.
[Details and limits](RELEASE-0.1.6.md).

Screenshots record the desktop browser's appearance. HTML retains resources
SingleFile could embed. Text supports comparisons of messages, offers and
headings. Images, fonts and external content may be missing if retrieval fails.

Errors do not overwrite old versions. Identical captures can share files, while
every check keeps its date: B → A is a new historical occurrence. These are
observation dates, not known publication/change times on the original site.

Animations, carousels, counters, popups and ads can create noise. Ignored selectors
help focus comparisons. Do not exclude prices/offers merely to reduce alerts:
that would hide the changes you want to follow.

## Comparison and loading quality

**Areas to monitor** selects ignored or important elements by clicking. A second
copy previews whether the rule selects the intended historical region. Excluded
content remains in complete screenshots/HTML; exclusions affect automatic
comparison only. Important regions take precedence. The first complete check
after changing rules saves an explicitly labelled new reference, distinct from
a site change.

Since **0.1.12**, a failed visible image, background, font or required resource
marks a partial load. The engine checks repeated page readings and reopens HTML
without network access to verify replay. Comparison references come from complete
copies; doubtful captures cannot replace them. Errors never delete older captures.

Missing content alone, or purely visual change, requires two consistent verified
visits at least 30 seconds apart. An intervening failure interrupts confirmation;
different errors do not confirm one another. At most two nearby retries occur,
after 1 and 5 minutes, before returning to the site's schedule. When paused or
scheduling is disabled, repeat checks manually.

The first observation is retained even if incomplete. Stable new content, such
as a changed price with a missing image, may be saved as evidence to review.
Unstable text or incomplete pages missing most content remain anomalies for
rechecking. A later complete copy can improve saved evidence.

Ordinary attempts add check records rather than versions. They may retain up to
3 temporary screenshots per page for 48 hours, within an overall limit of 512
samples and 1 GiB. These are excluded from permanent backups. Returns to an
earlier variant reuse files while keeping the new observation date.

**Useful versions**, **By variant** and **All observations** separate changes from
attempts. Older captures remain in **Earlier archive**. **Preview cleanup** offers
limited candidates with nothing preselected. First copies, reference, latest
copy, new evidence, favorites, notes and tags are protected. Confirmation removes
unshared files for selected copies while retaining check dates/results. Recovery
requires an earlier backup. [Details](RELEASE-0.1.12.md).

## Clear all copies of a site

Choose **Clear copies and scan again**. The preview counts all copies and those
with notes, tags or favorites. Nothing is deleted without confirmation. The
command keeps the site, pages, settings and page notes, clears comparison
references and queues fresh manual visits. A paused site stays paused for future
automatic checks.

Screenshots, HTML and version annotations are deleted; check dates remain without
their earlier files. Download the offered backup if you want recovery. A page
that has gone offline may no longer be capturable. Other sites' copies remain.

## Storage and resource limits

Since 0.1.2, confirmed site deletion removes its archive, preserving files shared
with other sites. Old versions are not automatically deleted to make room.
The initial reserve is 5 GiB (about 5.4 GB): an emergency safeguard, not recommended
working headroom. Monitor the app and Umbrel storage screens and leave much more
room for the OS and other applications.

Illustrative sizing, not a measurement: 100 pages each adding a 5 MB version daily
produce about 183 GB/year. Actual growth depends on retained changes and embedded
resources. Unchanged checks do not require another full copy.

Docker limits the worker to 3 GB and 2 logical CPUs, and the app to 1 GB and
1 logical CPU. A heavy page may still exhaust its limit. Investigate and record
memory failures; they must not delete earlier copies. Limits can be adjusted in
test packaging, but effectiveness must be measured on the device.

## Backup and restore

**Backup and restore** exports a consistent database and referenced files while
the app is running: `archive.sqlite`, `objects/` and `manifest.json`. It preserves
the account and password hash, revokes sessions in the exported copy and excludes
the worker token, which can be regenerated. ZIPs are unencrypted private data;
store them on protected media.

The guided import available since 0.1.10 validates a backup before replacement,
requires confirmation/current password, keeps a safety copy, preserves the current
account and pauses sites. A per-site browsing ZIP cannot be imported as a full
backup. [Guided restore limits](RELEASE-0.1.10.md).

For administrative restoration of a complete ZIP:

1. Verify integrity and the version in `manifest.json`; keep a second ZIP copy.
2. Stop app and worker. Restore into an empty installation of the same version,
   or preserve all existing data separately. Never combine one database with
   another object directory.
3. Extract `archive.sqlite` and all of `objects/` into the empty data directory.
   The manifest is informational. Do not restore another instance's SQLite
   `-wal`/`-shm` files, old tokens or sessions.
4. Set ownership to UID/GID `1000:1000`; do not grant world-write permissions.
5. Start the app then worker, as Compose manages. Missing tokens and temporary
   directories are recreated. Sign in with the original backup credentials;
   previously connected devices need a new login.
6. Check sites, versions and screenshots before normal monitoring. Unlike guided
   import, manual replacement retains database schedules, so overdue jobs can run.

Do not upload backups to the community store or copy them into source directories.

### Full-volume copies

Keep a copy of the entire persistent directory, including database, captures and
secrets, on another disk. HTML alone loses timeline/settings; the database alone
loses archived pages. A backup on the same SSD does not protect against disk
failure.

Umbrel stores archive data in `${APP_DATA_DIR}/data`, included in app backups.
For manual volume copying, stop both services in Umbrel, copy everything with its
ownership/permissions, then restart. Locally use `docker compose stop` before
copying and `docker compose up -d` afterward. Copying SQLite during writes can
produce an inconsistent backup.

Test restoration in a separate installation: stop services, restore all data
with UID/GID `1000:1000`, start the same app version, verify login, version counts
and sample captures, then upgrade. Never put backup directories in Git or Docker
images.

## Restarts and updates

Schedules are persistent application data, not Umbrel host cron jobs. Startup
prepares the database/secrets before making the worker available. Containers
receive SIGTERM with a 90-second shutdown allowance; `init` reaps browser children.

Back up before updating. In development, rebuild with `docker compose up --build
-d`. Through Umbrel, update only to an available release with a tested image.
Do not downgrade a database without explicit compatibility instructions.

## Troubleshooting

Use **Download now** on **Monitored sites**, or **Check and download now** inside
a site. Manual checks work while paused and take priority over queued jobs.
**Restart check** interrupts an active attempt and queues a new one. The status
box shows progress and the last error. An unchanged visit records a check without
a duplicate version.

The old generic capture failure for redirected pages was fixed in 0.1.2. Check
the sidebar version. That fix does not bypass CAPTCHA, site outages or browser
startup problems. For **Failed to fetch** immediately after launch, use 0.1.14
or later and reopen the app through Umbrel; see [the proxy fix](RELEASE-0.1.14.md).

**Delete site** offers a backup before confirmation. Wait for the backup to finish;
the app prevents deletion from interrupting export. There is no recycle bin:
restoring deleted copies requires an earlier backup.

| Symptom | Check |
| --- | --- |
| No captures start | Worker status, queue, next run and free space |
| Browser cannot start | Pinned browser version, worker AppArmor profile, Linux user namespaces and seccomp |
| Blank or partial copy | Cookie banner, slow loading, anti-bot blocks and external resources |
| Repeated changes | Carousels, dynamic dates, personalization and ignored regions |
| Data permission denied | Persistent directory ownership `1000:1000`, especially after restore |
| Store image unavailable | Package/publication status; this is not an archive failure |

For local tests, `docker compose ps` shows state and `docker compose logs
--tail=100 web worker` shows recent messages. Logs can contain monitored URLs:
remove them, tokens and machine paths before sharing. Do not submit a database
or capture archive with an issue.

## Isolation

Since 0.1.3, a dedicated worker AppArmor profile loaded by the app hook addresses
`userns_create` rejection in Docker's default profile on recent systems. Update
and restart through Umbrel if browser isolation is denied. Look for
`browser_startup_failed` in engine logs and
`dedicated worker AppArmor profile loaded` in startup logs.
[Fix and diagnostics](RELEASE-0.1.3.md).

The web service manages the archive; the worker visits external sites. Both run
without root or added capabilities. The worker requires Chromium's sandbox and
reads only its internal token, not the archive. seccomp permits namespaces
required by Playwright.

The profile derives from Playwright 1.63.0. Documented changes return ENOSYS for
`clone3` to permit fallback to `clone`, allow `close_range`, `epoll_pwait2` and
`faccessat2`, and allow the namespace-scoped `chroot` needed by Chromium. Validate
on the actual kernel; do not use `seccomp=unconfined` or host privileges to force
a failing capture to start.

Edit the distributed `seccomp-profile.json.template`, not Umbrel's generated
`seccomp-profile.json`. Umbrel renders it on start/update; the template contains
no variables and can also be read directly by local Compose.

References: [Playwright Docker](https://playwright.dev/docs/docker),
[original profile](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json),
[Docker profile](https://github.com/moby/profiles/blob/main/seccomp/default.json).

## Access since 0.1.13

Old sessions are invalidated while accounts/passwords remain. The current
session lives in a browser tab and survives reloads; an independent tab may need
another login. Apps on other ports do not receive the archive credential.
Previews/downloads use short-lived authorization for individual resources.

The engine reads its token from `worker-auth`. Umbrel's hook prepares permissions;
the web service migrates an existing token at first startup. No manual database
or capture move is needed.

HTTP is still unencrypted. Use a trusted LAN, VPN or administrator-managed HTTPS
proxy; do not directly expose the app port to the Internet. These changes do not
install a TLS certificate or modify global device networking.

Copies above processing limits retain their screenshot and show a warning.
Historical HTML is sanitized when downloaded without rewriting the original
object. Full backups preserve objects for faithful restoration; import validation
does not execute HTML. [Security assessment and limitations](SECURITY-0.1.13.md).
