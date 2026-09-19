# Fixing startup through Umbrel — 0.1.14

Version 0.1.13 could display “Failed to fetch” before the login screen. The
initial request to `/api/auth/status` excluded all cookies, including the one
required by Umbrel's proxy. The proxy redirected to its own login, which the
client rejected as intended to protect credentials.

Version 0.1.14 lets the browser send cookies in requests to the app's own origin.
The proxy can validate its cookie and forward the request. Landing Archive still
requires its own Bearer credential for private APIs: Umbrel's cookie alone does
not open the archive. Old Landing Archive session cookies remain invalid.

The same-origin API restriction, redirect rejection, resource-specific tickets,
session separation between ports, browser sandbox, and the other
[0.1.13 protections](SECURITY-0.1.13.md) remain enabled.

Proxy behavior is documented in the Umbrel 1.7.4 source:
[cookie authentication](https://github.com/getumbrel/umbrel/blob/1.7.4/containers/app-proxy/utils/auth.js)
and [forwarding with proxy-cookie removal](https://github.com/getumbrel/umbrel/blob/1.7.4/containers/app-proxy/utils/proxy.js).

## Update

Update from the community store without uninstalling, then reopen the app from
Umbrel. Accounts, settings, and archives remain unchanged; the schema stays at 5.
If prompted to log in, use your existing username and password. The interface
and worker should both display version 0.1.14.

## Testing

A dedicated browser test goes through a local proxy that reproduces Umbrel's
authentication steps, including removing its cookie before forwarding to the
web service. Testing on the user's actual Umbrel device remains separate.
Verification results are recorded in [TESTING.md](TESTING.md).
