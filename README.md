# milepost-indexer

The [Milepost](https://github.com/milepost-labs/milepost) contracts can answer
"what is this address's award?" but not "who has an award?": they store data
under per-address keys and keep no lists. This repository builds those lists
from the events the contracts emit, and publishes them as static JSON for
[milepost-frontend](https://github.com/milepost-labs/milepost-frontend) and
anyone else integrating with Milepost.

## How it works

A run is one pass that exits:

1. Loads its saved position from `state.json` in a data directory, and the
   contract ids from milepost's
   [`packages/testnet.json`](https://github.com/milepost-labs/milepost/blob/main/packages/testnet.json).
2. Reads every event since that position from Stellar RPC (`getEvents`): first
   from the registry, attest, record and policy_spend contracts, then from every
   known programme, including any the first pass just discovered.
3. Decodes each event with the contract spec embedded in the published
   `@milepost/*` bindings.
4. Applies the events in chain order, each through its handler in
   `src/handlers/`.
5. Writes `state.json` and the published files under `public/v1/`.

A run needs nothing but the saved state, so no process has to stay up between
runs.

## Published data

A scheduled workflow, [`.github/workflows/index.yml`](.github/workflows/index.yml),
runs the indexer every 10 minutes. Each run restores `state.json` from the
`data` branch, indexes, replaces that branch with a single commit holding the
new state and files, and deploys the files to GitHub Pages:

https://milepost-labs.github.io/milepost-indexer/v1/meta.json

Any site can fetch them. [docs/outputs.md](docs/outputs.md) documents each
file.

### Operating it

- **Run it now:** `gh workflow run index.yml`, or **Run workflow** on the
  Actions tab.
- **Rebuild:** run it with `reset` ticked. Do this after merging a new or
  changed handler, so the events it missed are applied.
- **Failures:** GitHub emails a failed scheduled run to whoever last changed its
  schedule. A run that fails at "Fail if events were lost" has still saved and
  published; see [Limits](#limits).
- **Stopped schedule:** GitHub disables scheduled workflows in a public
  repository after 60 days without activity, and does not say whether the
  indexer's own pushes to `data` count. If `indexedAt` in `meta.json` stops
  moving, run `gh workflow enable index.yml`, then run it once.
- **Late runs:** GitHub can start a scheduled run late when it is busy. RPC
  retention of about 7 days leaves plenty of room to catch up.

## Trusting the data

A list here says where to look, not what is true. Before relying on an entry,
read the contract for it (`get_award`, `is_payee`, …). A stale or wrong list
can then hide something, but never make an app show something false.

## Running it locally

Requires Node 24.

```sh
npm ci
npm run index -- --data ./data
```

Then open `data/public/v1/meta.json`. Running the same command again continues
from where the last run stopped.

| Option | Effect |
| :--- | :--- |
| `--reset` | Discard `state.json` and rebuild from the start |
| `--to-ledger <n>` | Stop before ledger `n` instead of the latest ledger |

| Environment variable | Default |
| :--- | :--- |
| `MILEPOST_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `MILEPOST_DEPLOYMENT` | milepost's `packages/testnet.json` on `main` (a URL or a local path) |

## Limits

- **Retention.** Stellar RPC keeps about 7 days of events (120,960 ledgers).
  Reading starts at the deployment's `deployed_ledger`. If the deployment is
  older than the window, or its file has no `deployed_ledger`, reading starts
  inside the window and `meta.json` says `"complete": false`.
- **Gaps.** If runs stop for longer than the window, the events in between are
  lost. The next run carries on, sets `"gap": true`, and exits with status 1 so
  the failure is noticed. Only a reset clears the flag.
- **Old programmes.** A programme created before the window is still found,
  through the registry's `nonce` and `programme_address`. Its name is recorded
  only in the creation event, so it stays `null`.
- **Resets.** A different registry in the deployment file, or a network whose
  latest ledger is far below the saved position (a testnet reset), makes the
  run rebuild from scratch.
- **Coverage.** Only some events have handlers so far. `meta.json` counts the
  rest under `unhandledEvents`.

## Published files

[docs/outputs.md](docs/outputs.md) documents every file and the versioning
rule.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Most work here is adding an event,
which [docs/adding-an-event.md](docs/adding-an-event.md) walks through.

## License

[Apache-2.0](LICENSE)
