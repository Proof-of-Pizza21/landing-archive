# Capture quality and readable history — 0.1.12

This release addresses resources or sections that failed to load being mistaken
for changes, causing unnecessary archive growth. Migration is additive: no
older copy is automatically deleted.

## Capture and comparison baseline

The engine checks page stability while loading and gathers signals about images
and resources required for display. Loading quality and HTML-copy quality are
recorded separately. An image failing to load is not the same as its replacement.

Uncertain copies do not automatically replace the reliable baseline. First
observations and stable evidence of new content are retained even before
confirmation: a short-lived landing page or offer may be gone by the next check.
Missing content alone requires a specific verification, separate from simply
repeating an error.

Visual-only differences and absences require two consistent verified visits at
least 30 seconds apart. An error breaks confirmation. There are at most two
near-term retries (after 1 and 5 minutes), then the normal schedule resumes.
While monitoring is paused, manual checking remains available without enabling
the schedule again.

## Browsing history

The timeline distinguishes versions, observations awaiting verification, and
older copies without the new quality data. Recurrences can be grouped while
preserving check dates. A return from A → B → A remains available.

Comparison also shows images whose file changed at the same URL, unloaded
resources, and identical files served from different URLs. These indicators
appear when both copies contain the relevant information; they are not invented
for older archives. Details also distinguish changed text from recognized
sections that only moved; section matching remains an estimate.

## Storage and reviewing older copies

Diagnostic files from ordinary attempts are temporary and separate from archive
versions. New evidence, first copies, and retained versions do not expire under
the diagnostic policy. Limits are 3 samples per page, 512 overall, 48 hours, and
1 GiB; check records remain.

Review suggests only a limited set of candidates: duplicates with identical
content and files, or historical copies marked partial that add no content
between two matching complete states. A partial copy can still document a real
temporary state: each candidate requires explicit selection and confirmation in
the interface.

First copies, the latest copy, the current baseline, new observations, favorites,
notes, and tags are protected. If the archive changes after preview, refresh it.
Check and event dates remain recorded after selected files are deleted; the
observation states that original files were removed. Recovering those files
requires an earlier backup.

Identical files were already shared: reducing the number of entries does not
necessarily reclaim disk space. The preview calculates physically reclaimable
bytes, accounting for files still used by other versions.

## Start fresh for one site

**Reset copies and recapture**, in site details, deletes every copy of the
selected site after preview and confirmation: this includes first copies,
baselines, favorites, tags, and version notes. The site, URLs, settings, and
page notes remain. Check dates stay recorded and indicate that original files
were removed.

Active jobs are canceled and late results discarded. All known pages receive
a fresh manual check; if the page limit permits more pages, discovery also
restarts. The first result is not compared with old copies. Monitoring pause
status is unchanged.

The preview becomes invalid if copies or checks change. An active backup or
restore prevents resetting. The button offers a backup to download first:
deleted files cannot be recovered from the app, and scanning cannot recreate a
page that has disappeared. Files shared with other sites remain protected.

## Update and backup

The app and worker must be updated together. The home page shows the worker
version and reports incompatibilities; results from the old protocol cannot
bypass the new quality checks.

The archive schema becomes 5. Full backups preserve versions, observations,
notes, and new metadata. Temporary diagnostics are not included in the ZIP.
Restore remains isolated, validates references, and leaves sites paused.
Compatible earlier backups can still be imported.

## Limitations and testing

A stable page can be permanently broken; two matching visits alone do not prove
that a removal is intentional. Observed variants do not prove an A/B test, and
a page that appears and disappears between visits cannot be detected.

Testing covers complete/partial/recovered sequences, price changes, failed
resources, replaced creatives, specific confirmations, preservation of first
samples, recurrences, diagnostic limits, and cleanup protections. Completed
results and environment limitations are recorded in [Testing](TESTING.md).
Validation on the user's mini PC remains separate from local and Linux
container checks.
