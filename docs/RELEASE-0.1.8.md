# More reliable comparisons and landing-page lifecycle — 0.1.8

## Fewer unnecessary copies

Visual comparison uses original coordinates without stretching screenshots.
Height or width differences of up to 3 pixels no longer automatically count
as a change. A neighborhood comparison of the sample tolerates small shifts
(approximately 1–3 original pixels, depending on width); the 0.5% threshold on
considered pixels remains. Text, title, headings, links, and image URLs are
checked separately: even a small price change can create a version. An important
region uses its own area as the visual-comparison reference, so its change is
not diluted across a long page.

Only known advertising parameters are excluded from comparison: standard UTM
fields and identifiers such as gclid, fbclid, and msclkid. Original URLs remain
in the files. Product, language, price, experiment, image-revision, and cache
parameters are not indiscriminately removed.

Old signatures are recalculated from stored metadata during comparison without
rewriting or deleting history. A return from A → B → A remains recorded.
Manual comparison shows complete copies, including excluded regions.

## Complete and partial captures

After scrolling for lazy-loaded content, the browser also waits a bounded time
for images to decode. Unloaded visible images, missing stylesheets, or an empty
page produce structured quality information shown with copies and checks.

A partial copy with unchanged content does not create a version solely because
its screenshot differs. New content is preserved with a warning; the first copy
of a landing page is always saved. Text falling below 30% of a previous copy
with more than 300 characters requires a confirmation check. Every attempt is
recorded. One recheck after five minutes is scheduled for an incomplete sequence;
normal scheduling then resumes. Pausing and disabling the coordinator are
respected.

Limitation: while a page is incomplete, visual-only differences are unreliable
and do not create versions. Text and metadata are still compared. Quality checks
do not certify a complete website: video, interactive services, resources not
embedded offline, and content beyond capture limits may be absent. SingleFile
warnings remain available.

## Monitoring regions

Open a page and choose **Monitoring regions**. Click an element, optionally
expand the selection, then choose **Exclude from comparison** or **Mark as
important**. **Also show the previous copy** lets you check the number and
content of selected elements before saving. Excluded regions are orange;
important ones are green. An important region takes priority over a broader
exclusion.

Rules apply to the selected page; advanced site exclusions still apply.
The combined limit is 30 exclusions and 20 important regions per page. Rules
identify page elements, not fixed coordinates. Offline layout can differ,
and a site structure change may require selecting regions again. A missing
important element produces a warning. The first complete check after a rule
change saves an explicitly labeled reference without reporting a website change.

New HTML copies and screenshots remain complete. Old screenshots that already
contained masks cannot be reconstructed. The editor uses inert copies, with
no scripts, forms, or Internet requests; its rules API requires the same
authentication and origin protection as other APIs.

## Landing-page lifecycle

Site details show first discovery, source, last successful capture, changes,
and the latest check. Filters distinguish new, changed, unreachable, returned,
and missing-from-sitemap pages. Categories describe the last observed event:
they do not establish when a site published a page or the results of a
commercial test.

Sitemap absence is determined only from complete reads of the same sources.
Missing sitemaps, errors, or limited results do not mark a page offline. HTTP
checks are separate: two consecutive 404/410 responses confirm disappearance,
and a later capture records its return.

Discovery frequency is independent of check frequency (default 24 hours,
configurable from 1 to 8,760 hours). Paths can be included or excluded; the
prefix /offerte includes /offerte and descendants, but not /offerte-altre.
Rules apply to new automatic discoveries, not to pages already monitored or
added manually. Time, request, page, and robots.txt limits remain. Landing pages
linked only from ads or emails need to be added manually.

## Update and operational limits

Migration to schema 3 adds fields without deleting accounts, versions, checks,
or files. Export a backup before updating. Returning to 0.1.7 requires restoring
a backup from before migration. The update does not remove similar copies
accumulated earlier.

Browser isolation, private-network protections, PNG decoding in a separate
process, memory/time limits, the worker's read-only archive access, and the
absence of cloud capture services are retained.
