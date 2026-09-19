# Activity, collection, and backups — 0.1.9

## Unread activity

The new sidebar section groups events by site. It initially shows the last seven
days for competitors; you can change the period, select your own sites or one
specific site, include read events, and choose event types. Dates selected in the
interface follow the browser's time zone.

You can mark an event as read or unread again. The bulk button affects only the
events on the visible page, up to 200; it does not include events that arrive
later. An event with a version opens that exact copy. A discovery or error without
a version opens page history. Preferences and read status are shared within the
local archive and included in backups. They do not delete events, checks, or
versions. There are no external notifications, emails, or automatic analysis of
business strategies.

## Collection and version notes

In page details, below the selected copy, you can annotate that specific capture:
a note of up to 20,000 characters, a favorite flag, and up to 12 tags of 40
characters each. Tags such as `Webinar` and `webinar` are merged. Existing site
and page notes remain independent.

The Collection shows only versions with notes, tags, or favorites. Search covers
title, URL, annotation, and tags; filters combine site, date, exact tag, and
favorites. Results are paginated, 100 at a time, and open the original version.
Annotations are plain text, with no HTML execution. Deleting a site also deletes
its annotations and read status.

## Export an offline site

From site details, **Export offline site** prepares a ZIP to extract and browse
by opening `index.html`. It includes all site versions in chronological order,
notes, tags, favorites, screenshots, and HTML viewing copies. Each copy displays
its date and links to the index and screenshot.

Internal links lead to the latest version on or before the date of the page you
are navigating from; if none exists, they use the first later copy. The date
changes as you navigate, so check the bar. This is not a simultaneous capture of
the entire site. Links with no copy remain inactive. Scripts, forms, and external
resources are blocked: browsing does not recreate interactive services, video,
or resources that were not embedded in the capture.

Original copies stay intact in the app. A copy exceeding 12 MiB or the offline
view's complexity limits is replaced in the export by a warning and a screenshot
link; the index identifies it. A missing screenshot file stops the export.
The limit is 20,000 versions per site; beyond that, use the complete backup.
Documents are processed one at a time and the index is prepared on disk.
This ZIP is for browsing, not restoration.

## Guided backup and restore

The new sidebar section keeps **Download full backup** and adds uploading a
backup ZIP through the interface. Older complete backups using schemas 1–3
are supported within the same security limits as schema 4.

1. Select the full ZIP and choose **Upload and verify backup**. Upload proceeds
   in 1 MiB chunks with visible progress. Verification shows sites, pages,
   versions, checks, backup date, and file size.
2. Confirm replacement of the entire archive and enter the password for your
   current account. Restore does not merge archives. First download any backups
   you want to keep, including to a separate device.
3. The app waits for active operations, pauses the worker, creates a complete
   safety copy of the current archive, and applies the new history in a
   transaction. Other archive operations are suspended during replacement.
4. Your current account remains valid afterward. Accounts in the backup do not
   replace current access. All sites are paused and the queue is cleared;
   resume them in settings when ready.

**Before the last restore** lets you download the safety copy. The next restore
replaces it; save it elsewhere to retain it. It is a complete backup that can
be uploaded through the same procedure.

ZIP verification checks allowed paths, duplicates, encrypted files, symbolic
links, CRC, SHA-256 hashes, sizes, data references, metadata, and PNGs. The
uploaded database is read in a separate process and rebuilt using the app's
schema: backup triggers, views, and code are not installed. Files are verified before
database changes; a transaction error leaves previous history intact. An interruption
before the transaction can leave unreferenced files without deleting history.

Guided restore limits: a ZIP up to 32 GiB, extracted content up to 64 GiB
(further restricted by free space), database up to 1 GiB, 100,000 capture files,
500 sites, 100,000 pages, and 5 million rows in total. Current metadata and image
limits apply; older captures beyond them require manual restoration. Verification
has a 10-minute deadline, one upload is allowed at a time, and uploads expire
after one hour of inactivity. Restarting discards incomplete uploads.
Verification and the safety copy require additional space; the emergency reserve
remains protected. Keep the page open and the connection stable during restore.

## Update

Migration to schema 4 adds three tables and indexes without rewriting copies,
accounts, or checks. Download a backup from the previous version and update
through Umbrel without uninstalling the app. Older similar copies remain.
Returning to an earlier version also requires a backup from before migration.
Do not manually replace the database while services are running.
