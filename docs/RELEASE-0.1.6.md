# Offline pages in the archive — 0.1.6

Each version can be viewed in the new **Offline page** tab, beside **Screenshot**.
The view uses HTML already stored in the archive: it works with earlier captures
and does not require downloading the website again. You can scroll, use browser
zoom, and select text. The expand control increases the view's height.

## Navigation and dates

Links open only copies belonging to the same monitored site. The date selected
in the timeline remains the reference throughout navigation. For each page, the
latest copy captured on or before that date is selected; if none exists, the
first later copy is shown with an explicit warning. The opened page's URL and
actual capture date are always displayed above the document. URL parameters are
preserved.

**Back** returns through up to 50 visited pages within the view. Internal anchors
jump to a section. A link without an available copy shows a warning and does not
open the live site. **Download this page** exports the original HTML of the
currently open copy; the downloaded file retains its original links and is not
a whole-site export with local navigation.

Copies of different pages are not necessarily simultaneous: the displayed date
is the actual capture time, not a guaranteed reconstruction of the entire site
at one precise moment.

## Isolation and limitations

The view generates a derived document without changing stored files. An HTML
parser removes scripts, event handlers, active forms, frames, automatic
redirects, external link destinations, and attributes that can initiate
navigation. Embedded images and styles remain available. An iframe without
script execution permission and a separate Content Security Policy block
scripts, external requests, frames, forms, popups, and top-level navigation.
The app handles clicks through validated copy identifiers.

The iframe retains the app's origin solely so its parent can read the rewritten
links; it does not include `allow-scripts`. View responses require authentication,
are not cached, and can be embedded only by the same origin. Other app pages
continue to prohibit embedding.

Preparing the view accepts at most 12 MiB of HTML, 50,000 nodes, and 150 nesting
levels. Copies beyond these limits remain available to download and as
screenshots. JavaScript menus, forms, videos, carousels, and online services may
not work. Resources that were not embedded during capture are not fetched from
the Internet.

## Update

Export a backup and update the existing installation from the community store.
Account, archive, schedule, and database schema remain unchanged. Check for
**0.1.6** in the sidebar, open a page, and select a version in the timeline:
**Offline page** is the initial view.

Testing includes real browser navigation, date selection, missing links,
anchors, the mobile interface, authentication, and hostile attempts to run
scripts or contact the network. Publication results are recorded in
[Testing](TESTING.md).
