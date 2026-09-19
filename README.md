# Landing Archive

Keep a private, browsable history of your websites and your competitors' landing
pages on Umbrel. See what changed, revisit offers that disappeared, and collect
notes on the versions that matter—all on your own disk, without a cloud account.

**English is the default language.** Choose English or Italian in **Settings →
Language**. The preference applies to your browser; switching languages does not
change the content of archived websites.

**Preview for 64-bit Intel/AMD mini PCs (`linux/amd64`), targeting umbrelOS 1.7.4.**
ARM is not included. Images are published only after the
[Linux checks](https://github.com/Proof-of-Pizza21/landing-archive/actions/workflows/verify-and-publish.yml)
pass, and the community store pins the tested image by digest. Automated container
checks and validation on a particular Umbrel device are separate.

## What you can do

- **Monitor websites on your schedule.** Add a domain or a specific page, choose
  how often to check it, and discover new pages through public links and sitemaps.
- **Keep more than screenshots.** Save desktop screenshots, SingleFile HTML with
  embedded resources, and page text. Browse archived pages inside the app.
- **Follow changes over time.** Compare text, links, images, and highlighted
  screenshot regions. See newly discovered pages, confirmed disappearances, and
  returns online.
- **Reduce noisy copies.** Loading-quality checks, a reliable comparison baseline,
  and confirmation visits help distinguish changes from resources that failed to
  load. Choose page regions to ignore or prioritize.
- **Organize your research.** Review unread activity, add notes and tags to
  versions, mark favorites, and search your collection.
- **Stay in control of your archive.** Run a priority manual check, restart a stuck
  attempt, export a browsable site ZIP, or back up and restore the complete archive.
  Deleting a site or resetting its copies requires confirmation.

Checks and versions are separate: a visit with no changes records its date without
creating another identical copy. A return from A → B → A remains in the timeline,
while identical files can share storage. Failed visits do not erase earlier copies.

## Install on Umbrel

1. Open the community app store manager in the Umbrel App Store.
2. Add [the Landing Archive community store](https://github.com/Proof-of-Pizza21/umbrel-community-store).
3. Open **Landing Archive Community Store**, install **Landing Archive**, and launch it.
4. Create an archive account with a password of at least **12 characters**.
5. Add your first domain or page and choose a check interval.

There are no default credentials. The archive login adds protection alongside
Umbrel's authenticated proxy. Start with one site and check that its first copy
is readable before adding more.

Before an update, download a backup and update the existing installation without
uninstalling it. Follow the instructions for your release:
[releases and update notes](https://github.com/Proof-of-Pizza21/landing-archive/releases).

## Run locally with Docker

Requires Docker Engine or Docker Desktop with Compose. On Linux with AppArmor
enabled, load the dedicated worker profile first:

```sh
sudo bash umbrel-community-store/proof-of-pizza21-landing-archive/hooks/pre-start
```

Then start the services:

```sh
docker compose up --build -d
```

Open `http://localhost:4310` and create your archive account. The local port binds
only to `127.0.0.1`; the browser worker exposes no host port. This setup is for
local testing. The Umbrel package uses Umbrel's proxy and login.

See [Installation](docs/INSTALL.md) for setup and publishing instructions,
[Operations](docs/OPERATIONS.md) for backups, storage, and troubleshooting, and
[Testing](docs/TESTING.md) for recorded results and remaining device checks.

## Designed for a focused archive

Visits run one at a time to limit browser load. The starting schedule is a page
check every 6 hours and discovery every 24 hours; both are configurable. Old
versions are not automatically deleted to make room.

Docker limits the web service to 1 GB of RAM and the worker to 3 GB. These are
container ceilings, not constant usage. Actual performance depends on the pages
and should be measured on the target device.

Pages without public links or sitemap entries need to be added manually. The app
does not sign into websites, bypass CAPTCHAs, record video, reconstruct entire
interactive services, or automatically discover advertising campaigns. An HTML
copy is a preserved document, not a fully functioning online service. Observed
variants do not prove an A/B test or reveal conversion results; pages that appear
and disappear between visits cannot be captured.

## Architecture and security

| Component | Role |
| --- | --- |
| React and Vite | Interface, timeline, and comparison |
| Fastify on Node.js 24 | API, accounts, scheduling, and archive management |
| SQLite | Sites, pages, checks, and version references |
| Playwright and Chromium worker | Website visits and screenshots |
| SingleFile Core | HTML copies with resources embedded when retrievable |
| Docker Compose | Separate app and worker with persistent storage |

Landing Archive is not a fork of ArchiveBox or changedetection.io. Its site,
landing-page, and history features are original application code, using the browser
and HTML components from their respective projects.

The browser sandbox stays enabled. Archived HTML is sanitized and isolated from
the app; the worker mounts only its authentication-token directory, read-only.
See the [security report](docs/SECURITY-0.1.13.md) for protections and remaining
limitations, including system-package advisories. HTTP is not encrypted: use a
trusted local network, a VPN, or a separately managed HTTPS proxy.

## Release history

See [English and Italian in 0.1.15](docs/RELEASE-0.1.15.md).
Detailed historical notes are available for
[manual checks and deletion](docs/RELEASE-0.1.2.md),
[Umbrel browser startup](docs/RELEASE-0.1.3.md),
[offline browsing](docs/RELEASE-0.1.6.md),
[highlighted comparisons](docs/RELEASE-0.1.7.md),
[monitoring regions and landing lifecycle](docs/RELEASE-0.1.8.md),
[activity, collection, and restore](docs/RELEASE-0.1.10.md),
[capture quality and history cleanup](docs/RELEASE-0.1.12.md),
[security hardening](docs/SECURITY-0.1.13.md), and
[the Umbrel proxy fix](docs/RELEASE-0.1.14.md).
The protections from [0.1.1](docs/SECURITY-0.1.1.md) also remain in effect.

## Data and licensing

Archive data, URLs, passwords, and tokens stay in persistent storage. Do not put
personal test sites, captures, credentials, or local logs in source commits,
Docker images, store screenshots, or public issue reports. The Docker build
context admits only the application files it needs.

Copyright © 2026 Proof-of-Pizza21. Application code is licensed under
**AGPL-3.0-or-later**; see [LICENSE](LICENSE). Dependencies retain their licenses
and attributions, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Archived content remains the property of its respective rights holders and does
not become part of the project's source code.
