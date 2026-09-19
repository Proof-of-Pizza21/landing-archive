# Highlighting changes — 0.1.7

Open a page, select a version, and choose **Compare**. The app suggests the
previous copy; for the first capture, it uses the next copy. You can choose
any two dates from the menus.

## Where the page changed

In **Appearance**, orange regions outline screenshot differences. **Previous
change**, **Next change**, and **Go to region** move to the selected region in
both copies. Scrolling is synchronized. **Highlight changes** lets you hide
the outlines and view the original image. On phones, copies appear one above
the other. Controls to open screenshots and download HTML remain available.

Images with different dimensions align at the top-left corner, without
stretching either copy to match the other. Missing areas have a hatched
background. Dimension differences are explicitly reported, even at one pixel.

## What the comparison detected

The summary distinguishes **text**, **title**, **headings**, **links**, **image
URLs**, and the **final page destination**. Buttons open the relevant details.
**Text** highlights removed and added words; **Links** shows URLs before and
after. **Details** lists changed titles, headings, destinations, and image URLs.
Image URLs are displayed as text without opening online resources.

If two screenshots match but a link or image URL parameter changed, the
comparison explains this without inventing a changed region. It shares
normalization rules with the engine that decides whether to create a version.

## Limitations and security

This release explains differences: **it does not change the thresholds that
trigger saving a version**. It compares the two selected copies, which may not
be consecutive. Animations, movement, banners, and incomplete loading can
highlight large areas; these alone do not prove an intentional website change.

Visual comparison uses a sample of at most 480 × 6,000 pixels, applies the same
color tolerance as the existing detector, and groups differing pixels into
nearby regions. Very small details may go undetected. The percentage refers to
sample pixels, not changed words or the importance of a change. Dimension
differences are shown separately. Beyond 100 regions, the remaining ones are
grouped into a larger area.

Calculation requires an authenticated session and two versions of the same page.
The response is not cached by the browser. The server allows one manual
calculation at a time, rate-limits requests, and keeps at most eight coordinate
results in memory. Images are validated before decoding in a separate process
with a limited V8 heap and a five-second deadline. The process is terminated if
the request closes. Oversized or invalid historical screenshots remain available
as originals, with a warning that highlighting is unavailable.

## Update

This feature works on existing copies without recapturing them or creating
permanent comparison files. Account, archive, schedule, and database schema
are preserved. Export a backup, update the existing app from the community
store, and check for **0.1.7** in the sidebar.
