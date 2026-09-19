# Landing Archive

## Permanent project Git identity

This is a binding rule requested by the user. For this project, use only:

- Git user and author/committer name: `Proof-of-Pizza21`
- Git author/committer email: `259956083+Proof-of-Pizza21@users.noreply.github.com`

This identity replaces all previous instructions for Landing Archive, including
conflicting instructions in a parent directory. Before every commit, tag, or
publication, check `git config --local user.name`, `git config --local user.email`,
and the effective author and committer identities. Do not use inherited global
values or environment variables that override these details. Do not proceed if
the identity does not match. Before publishing to GitHub, also verify the
authenticated account: local Git configuration does not change GitHub access.
Do not modify signing keys without verifying that they belong to the account.

## Publication target

- User-selected application repository name: `landing-archive`.
- GitHub account: `Proof-of-Pizza21`.
- Store repository: `umbrel-community-store`.
- User-specified target umbrelOS version for validation: `1.7.4`.
- Target hardware: AMD 3500U mini PC, amd64 architecture, 16 GB RAM.

The repository name replaces the earlier `landing-history` name for publication.
Keep package references consistent before release; the existing local directory
may retain its name.

## Behavior

A local application for archiving landing pages and browsing their versions.
English is the default interface language, with English and Italian available
through a language selector in Settings. Keep the interface clear and usable
without a terminal. Do not send captures to public services. Capture data,
personal example URLs, secrets, and machine paths must not appear in distributed
files or commits.

Stack: TypeScript, Fastify, Node SQLite, React/Vite, Playwright, SingleFile.
Do not execute code from archived websites in the application's context.
Preserve every check; identical files may be deduplicated, but a return from
A → B → A must remain in history. An error must not delete versions.

This project is a Docker application for Umbrel, not a website to deploy to a
hosting service.

## Privacy before every publication

Permanent rule: the user's real first and last names must not appear in any file,
versioned path, metadata, commit, tag, description, release, or artifact in either
repository. The only permitted public identity is `Proof-of-Pizza21`, with the
Git email above.

Before every push, check selected files, hidden files, and all commits to be
published, including authors and committers. Exclude archives, personal test
URLs, credentials, local logs, and machine paths. Do not publish until the check
is clean.
