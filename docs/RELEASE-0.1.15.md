# English by default and a language selector — 0.1.15

English becomes the default interface language. Open **Settings → Language**
to choose **English** or **Italiano**. The choice is saved in this browser's
`localStorage`, so it remains after reloading; another browser or device can
choose independently. It is a display preference, not a shared archive setting.

The repository documentation is now in English, including installation,
operations, historical release notes, testing, and security reports.

## Your archive stays unchanged

Switching the interface language does not translate archived websites, titles,
notes, or other user content. It does not change the locale used for website
captures, comparison rules, schedules, or existing copies. Site history remains
intact.

Before updating, download a backup and update the existing installation through
Umbrel without uninstalling it. Reopen the app to load the new interface. Choose
**Italiano** in Settings if you prefer to keep using Italian.

The selector is also available at login. Dates, numbers, help and system
messages follow the chosen language, including known messages from old captures.
Export navigation is in English. Screenshot links in cleanup previews now use
the same short-lived file authorization as the other archive views.

## Verification

Local type checks, build, 122 automated tests and 18 browser tests passed.
The language tests cover an Italian-configured browser, live switching, reloads,
invalid preferences, unavailable storage, cross-tab updates and unchanged
archived content. Desktop and phone settings were inspected.

Linux image publication is gated by a separate run of tests, security scanning
and actual-container checks. See [TESTING.md](TESTING.md) for recorded results.
