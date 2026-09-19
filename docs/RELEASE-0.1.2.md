# Manual checks, deletion, and redirects — 0.1.2

Version 0.1.2 adds direct controls for managing a site and fixes an error that
prevented some pages with HTTP redirects from being captured.

## Check and download now

This button is available in the site list, site details, and page history. It
moves pending work forward, clears the retry delay, and takes priority over
automatic checks. It also works while monitoring is paused, without enabling
the schedule again.

When work is already running for the selected site or page, the command becomes
**Restart check**: it cancels that attempt and prepares a new one. Work for other
sites is not canceled. Visits remain sequential; an active job for another site
must finish before the next one starts.

Every check makes a fresh visit and downloads the page. If nothing has changed,
it records the check without duplicating the version. Status shows whether work
is queued or running, elapsed time, and the last error. Capture errors identify
the stage that failed to complete.

## Delete site

The command requires confirmation in the interface. It removes the site, pages,
versions, notes, history, and associated jobs. It deletes files that no other site
uses; shared files remain available to other archives. A late result from a
canceled job cannot recreate the deleted site or versions.

Deletion is permanent in the app. The dialog lets you download a backup first;
while that export is running, deletion is refused with an explicit message.
Previously downloaded backups remain independent copies and are not modified.
If disk permissions prevent a file from being removed, the app reports that
some space could not be reclaimed.

## Download fix

An HTTP redirect could end with `ERR_PROXY_CONNECTION_FAILED`: the next request
did not pass through the browser's request handler again. This is a limitation
documented by [Playwright](https://playwright.dev/docs/api/class-page#page-route).

Redirects are now resolved by the app's controlled transport, with every
destination checked. The browser explicitly opens the final URL, preserving the
correct page origin and relative links. Redirected resources are also retrieved.
Cookies and sensitive headers are not forwarded to a different origin. Download
limits, private-network blocking, and browser isolation remain enabled.

## Archive update

The first startup adds a queue field to identify manual checks. Migration from
schema 1 to schema 2 is automatic and preserves accounts, sites, captures, and
pending jobs. Reinstallation is not required. Exporting a backup before updating
remains the recommended procedure. The security limits introduced in 0.1.1 remain
in effect.
