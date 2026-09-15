/**
 * Records the events contracts really emitted as a test fixture, so handler
 * tests can run against network data rather than only events built in tests.
 *
 *   npm run record-fixture -- --from 4700000 --to 4700500 \
 *     --programme C... [--programme C...] --out test/fixtures/awards.json
 *
 * The singleton contracts come from the deployment file (MILEPOST_DEPLOYMENT
 * overrides it) and each --programme adds a programme contract. The range
 * must still be inside the RPC's ~7-day retention window.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { rpc } from '@stellar/stellar-sdk';
import { configFromEnv, loadDeployment } from '../src/config.ts';
import { compareEventIds, filterBatches } from '../src/fetch.ts';
import type { ContractKind } from '../src/types.ts';
import type { Fixture } from '../test/helpers/fixtures.ts';

const USAGE = 'usage: npm run record-fixture -- --from <ledger> --to <ledger> [--programme <id>]... --out <file>';
const PAGE_LIMIT = 10_000;

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string' },
    programme: { type: 'string', multiple: true, default: [] },
    out: { type: 'string' },
  },
});

const from = Number(values.from);
const to = Number(values.to);
if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= from || !values.out) {
  console.error(USAGE);
  process.exit(2);
}

const config = configFromEnv();
const deployment = await loadDeployment(config.deployment);
const contracts: Record<string, ContractKind> = {
  [deployment.registry]: 'registry',
  [deployment.attest]: 'attest',
  [deployment.record]: 'record',
  [deployment.policy_spend]: 'policy_spend',
};
for (const id of values.programme) contracts[id] = 'program';

// `_getEvents` returns the response before the SDK parses its XDR, which is
// the form a fixture stores and tests parse the same way the SDK does.
const server = new rpc.Server(config.rpcUrl);
const byId = new Map<string, rpc.Api.RawEventResponse>();
for (const filters of filterBatches(Object.keys(contracts))) {
  let page = await server._getEvents({ filters, startLedger: from, endLedger: to, limit: PAGE_LIMIT });
  for (;;) {
    const inRange = page.events.filter((event) => event.ledger < to);
    for (const event of inRange) byId.set(event.id, event);
    if (page.events.length < PAGE_LIMIT || inRange.length < page.events.length) break;
    page = await server._getEvents({ filters, cursor: page.cursor, limit: PAGE_LIMIT });
  }
}

const fixture: Fixture = {
  network: deployment.network,
  from,
  to,
  contracts,
  events: [...byId.values()].sort(compareEventIds),
};
await mkdir(path.dirname(values.out), { recursive: true });
await writeFile(values.out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`wrote ${fixture.events.length} events to ${values.out}`);
