# Contributing to milepost-indexer

This repository builds lists from Milepost contract events. Contract, bindings
and protocol work happens in [milepost](https://github.com/milepost-labs/milepost),
and the app lives in [milepost-frontend](https://github.com/milepost-labs/milepost-frontend).
This repository uses the published `@milepost/*` packages.

## Prerequisites

| Tool | Version | Notes |
| :--- | :--- | :--- |
| Node.js | 24 | Runs the TypeScript directly with its built-in type stripping, so there is no build step |
| npm | bundled with Node | Do not use pnpm or yarn — they create lockfile conflicts |

## Local setup

```sh
git clone https://github.com/milepost-labs/milepost-indexer.git
cd milepost-indexer
npm ci
npm run index -- --data ./data
```

The [README](README.md#running-it-locally) lists the options and environment
variables.

## Checks

All of these must pass before a PR is ready, and CI runs the same:

```sh
npm run typecheck   # tsc
npm run lint        # eslint
npm test            # vitest
```

CI also fails on npm advisories at or above high severity in production
dependencies (`scripts/check-npm-advisories.sh`). Record an advisory exception
only with a stated reason, in `.github/npm-audit-exceptions.json`.

Tests never touch the network. `test/helpers/fake-source.ts` stands in for the
RPC and refuses the requests the real one would, and `test/helpers/events.ts`
builds events with the contracts' own specs.

Because Node runs the source as TypeScript, use only syntax it can strip: no
`enum`, no `namespace`, no constructor parameter properties. `tsc` enforces this
(`erasableSyntaxOnly`). Relative imports include the `.ts` extension.

## Where things live

| Path | What it does |
| :--- | :--- |
| `src/run.ts` | One run: the saved position, reset and gap detection, the two fetch passes |
| `src/fetch.ts` | `getEvents` paging and request batching |
| `src/decode.ts` | Decodes events with the specs from `src/specs.ts` |
| `src/handlers/` | One file per group of events; each handler updates the state |
| `src/reduce.ts` | The table of handlers |
| `src/outputs.ts` | Derives each published file from the state |
| `src/types.ts` | `State` and the other shared shapes |
| `scripts/record-fixture.ts` | Saves events from the network as a test fixture |

## Adding an event

See [docs/adding-an-event.md](docs/adding-an-event.md).

## Contract changes

If a list needs something no event carries, open the issue in
[milepost](https://github.com/milepost-labs/milepost/issues). This repository
only decodes events from released bindings.

## Issues and pull requests

1. Comment on the issue before starting, so it can be assigned and nobody
   duplicates the work.
2. Fork the repository and branch from `main`, named
   `<type>/<short-description>` — for example `feat/payees-list` or
   `fix/award-amounts`.
3. Write imperative commit subjects under 72 characters, with context in the
   body when it helps.
4. In the PR, link the issue with `Closes #<number>` and show the change
   working, with test output or the command you ran and what it printed.

PRs are squash-merged, so the PR title and description become the commit on
`main`.

## Security

Report vulnerabilities privately, as [SECURITY.md](SECURITY.md) describes, never
in a public issue.
