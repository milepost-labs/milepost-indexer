# Published files

Every file is JSON under `v1/`. A local run writes them to
`<data>/public/v1/`.

## Versioning

Within `v1`, files and fields are only ever added. Renaming or removing a file
or a field, or changing what a field holds, ships as `v2/` beside `v1/`, and
`v1/` keeps being published until readers have moved over.

Readers should ignore fields they do not recognise.

## Conventions

- Addresses are strkeys: `G…` for accounts, `C…` for contracts.
- Amounts are decimal strings in the token's smallest unit, because JSON numbers
  cannot hold an i128. Parse them with `BigInt`.
- Ledgers are numbers.
- Arrays are sorted by their identifying field.
- An entry says where to look, not what is true. Read the contract before
  relying on it.

## `meta.json`

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `network` | string | For example `testnet` |
| `registry` | string | The registry contract this index follows |
| `fromLedger` | number | First ledger read |
| `indexedToLedger` | number | Last ledger read; `fromLedger - 1` before anything has been read |
| `indexedAt` | string | ISO 8601 time of the run that wrote the file |
| `complete` | boolean | Reading started at or before the deployment, so no early event is missing |
| `gap` | boolean | Events were lost because runs stopped for longer than RPC retention |
| `unhandledEvents` | object | `<kind>:<EventName>` → how many events were seen that no handler applies |

`indexedAt` tells a reader whether the index has stopped updating.

## `programmes.json`

Every programme the registry has deployed, sorted by `id`.

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `id` | string | Programme contract |
| `name` | string \| null | From the registry's `ProgrammeCreated` event; `null` when that event is older than retention |
| `creator` | string \| null | Same source |
| `createdLedger` | number \| null | Same source |

## `programmes/{id}/awards.json`

The awards in one programme, sorted by `recipient`. The file exists for every
programme in `programmes.json` and is empty when the programme has no awards.

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `recipient` | string | The award's recipient |
| `granted` | string | Amount granted |
| `released` | string | Amount released so far |
| `tranches` | number | Tranches in the award |
| `tranchesReleased` | number | Tranches released so far |
| `payee` | string | Where released funds go |
| `mode` | string | `Direct`, `Allocated`, `Restricted` or `Open` |
| `updatedLedger` | number | Ledger of the `Awarded` or `Released` event this entry comes from |

Amounts are as of `updatedLedger`. A batch release does not update them yet, so
read `get_award(recipient)` for current amounts.
