# Adding an event

Most work in this repository is teaching the indexer one more event: turning it
into state, and the state into a published file. This is the recipe.

The worked example to copy is `program:Awarded` → `programmes/<id>/awards.json`:
the handler in [src/handlers/awards.ts](../src/handlers/awards.ts), the `awards`
output in [src/outputs.ts](../src/outputs.ts), and its tests in
[test/run.test.ts](../test/run.test.ts).

## 1. Find the event

Events are declared in the contracts in
[milepost](https://github.com/milepost-labs/milepost), for example
`contracts/program/src/lib.rs`. Each one is a struct marked `#[contractevent]`:

```rust
#[contractevent(topics = ["payee"], data_format = "single-value")]
pub struct PayeeChanged {
    #[topic]
    pub payee: Address,
    pub verified: bool,
}
```

The struct name is the event name. Every field, `#[topic]` or not, arrives in
`event.data` under its Rust name.

A handler's key is `<kind>:<StructName>`, where the kind is the emitting
contract: `registry`, `program`, `attest`, `record` or `policy_spend`. The example
above is `program:PayeeChanged`. A running index lists every event still without
a handler under `unhandledEvents` in `meta.json`, using the same keys.

Fields arrive already decoded. Narrow them with the helpers in
[src/handlers/values.ts](../src/handlers/values.ts):

| Contract type | In `event.data` | Helper |
| :--- | :--- | :--- |
| `Address`, `String`, `Symbol` | string | `asString` |
| `u32`, `i32` | number | `asNumber` |
| `i128`, `u64`, `i64` | bigint | `asAmount` (gives a decimal string) |
| `bool` | boolean | `asBoolean` |
| `BytesN<N>` | Buffer | `asHex` |
| struct | object with the Rust field names | `asRecord` |
| enum | `{ tag }` | `asTag` |

## 2. Add the state it needs

In [src/types.ts](../src/types.ts), add a field to `State`, keyed so the output
can be read straight from it. For example:
`payees: Record<string /* programme */, Record<string /* payee */, PayeeRecord>>`.

Add the field's empty value to `collections()` in
[src/state.ts](../src/state.ts), so a state saved before your change still
loads.

Store only JSON values: amounts as decimal strings, bytes as hex. Writing a
bigint fails the run on purpose.

## 3. Write the handler

Add a file in `src/handlers/`, or extend one for the same group of events, and
register its table in [src/reduce.ts](../src/reduce.ts):

```ts
export const payeeHandlers: Record<string, Handler> = {
  'program:PayeeChanged': (state, event) => {
    // update state from event.data
  },
};
```

A handler gets the state and one event, and changes the state. It must not read
anything else — no clock, no network — because a reset replays the same events
and has to arrive at the same result.

Events reach handlers in chain order. `event.contractId` is the emitting
contract; for `program:*` events that is the programme.

## 4. Publish it

Add an `Output` to [src/outputs.ts](../src/outputs.ts) and include it in
`outputs`.

- Sort arrays by a stable key, so an unchanged index publishes identical files.
- For per-programme files, write one for every programme in `state.programmes`,
  empty when there is nothing, so a programme the index knows never answers 404.

Document the file in [outputs.md](outputs.md). Adding a file or a field is fine
within `v1`. Renaming, removing or changing the type of anything already
published is not; outputs.md explains why.

## 5. Test it

Tests never use the network. Build events with `encodeEvent` from
[test/helpers/events.ts](../test/helpers/events.ts). It encodes them with the
contract's own spec, so a misnamed field fails at once:

```ts
encodeEvent(specs.program, 'PayeeChanged', { payee: PAYEE, verified: true }, { contractId: P1, ledger: 700 });
```

Put the events in a `FakeSource`, call `run`, and assert on the published file,
as `test/run.test.ts` does for awards. Cover an event that changes an existing
record as well as one that creates it.

To test against what the network really emitted, record a fixture while the
events are still inside the RPC's ~7-day window:

```sh
npm run record-fixture -- --from <ledger> --to <ledger> --programme <id> --out test/fixtures/<name>.json
```

Load it with `loadFixture` from
[test/helpers/fixtures.ts](../test/helpers/fixtures.ts) and replay it, as
[test/fixture.test.ts](../test/fixture.test.ts) does for the seeded testnet
scenario. That fixture already holds real `Applied`, `Reviewed`, `PayeeChanged`,
`Contributed`, `AllocationChanged`, `Directed`, `Attested` and `Credited`
events, so most new handlers can be tested against it without recording
anything.

## 6. After merge

Events that arrived before your handler existed were only counted, not applied.
After merge, a maintainer runs the `index` workflow with `reset` ticked, so the
new list covers everything still inside retention.
