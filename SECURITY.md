# Security Policy

This repository publishes the lists the Milepost app shows. The app checks each
entry on-chain before relying on it, but a flaw here can still hide an award or
a programme from the people it belongs to, or send someone to the wrong place.

## Reporting a vulnerability

Report privately, never in a public issue or pull request:

- **Preferred:** [GitHub private vulnerability reporting](https://github.com/milepost-labs/milepost/security/advisories/new) on the milepost repository.
- **Alternative:** email `security@milepost.io`.

Say that the report concerns `milepost-indexer`, and include the impact, steps
to reproduce, and any suggested fix. Response targets and the disclosure process
are the ones in milepost's
[SECURITY.md](https://github.com/milepost-labs/milepost/blob/main/SECURITY.md).

## Scope

**In scope:** code in this repository, especially event decoding and handlers,
what gets published, and the workflows' write access to this repository and its
Pages site.

**Out of scope:** the contracts and their generated bindings (report those
against milepost), the app (report those against milepost-frontend), Stellar RPC
and GitHub themselves, and bugs in third-party dependencies, which belong with
their upstream maintainers.
