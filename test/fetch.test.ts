import { describe, expect, it } from 'vitest';
import { fetchEvents, filterBatches } from '../src/fetch.ts';
import { loadSpecs } from '../src/specs.ts';
import { accountAddress, contractAddress } from './helpers/addresses.ts';
import { encodeEvent } from './helpers/events.ts';
import { FakeSource } from './helpers/fake-source.ts';

const specs = loadSpecs();
const DONOR = accountAddress(61);
const HEALTH = { latestLedger: 1_000, oldestLedger: 1 };

const contracts = (count: number) => Array.from({ length: count }, (_, i) => contractAddress(100 + i));
const contributed = (contractId: string, ledger: number) =>
  encodeEvent(specs.program, 'Contributed', { donor: DONOR, amount: 1n }, { contractId, ledger });

describe('filterBatches', () => {
  it('packs contract ids into the fewest requests the RPC accepts', () => {
    const ids = contracts(26);
    const batches = filterBatches(ids);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(5);
    expect(batches[0]!.every((filter) => filter.contractIds?.length === 5)).toBe(true);
    expect(batches[1]).toEqual([{ type: 'contract', contractIds: [ids[25]] }]);
  });

  it('makes no request for no contracts', () => {
    expect(filterBatches([])).toEqual([]);
  });
});

describe('fetchEvents', () => {
  it('reads every event from more contracts than one request can name', async () => {
    const ids = contracts(26);
    const events = ids.map((id, i) => contributed(id, 10 + i));
    const source = new FakeSource(HEALTH, events);

    const got = await fetchEvents(source, ids, 10, 100);

    expect(got.map((event) => event.id)).toEqual(events.map((event) => event.id));
    expect(source.calls).toHaveLength(2);
  });

  it('follows the cursor while pages are full', async () => {
    const [id] = contracts(1);
    const events = Array.from({ length: 7 }, (_, i) => contributed(id!, 10 + i));
    const source = new FakeSource(HEALTH, events);

    const got = await fetchEvents(source, [id!], 10, 100, { pageLimit: 3 });

    expect(got.map((event) => event.id)).toEqual(events.map((event) => event.id));
    expect(source.calls).toHaveLength(3);
  });

  it('keeps only ledgers in [from, to), once each, across ledger windows', async () => {
    const [id] = contracts(1);
    const source = new FakeSource(HEALTH, [9, 10, 11, 12, 15, 39, 40].map((ledger) => contributed(id!, ledger)));

    const got = await fetchEvents(source, [id!], 10, 40, { pageLimit: 3, ledgerWindow: 5 });

    expect(got.map((event) => event.ledger)).toEqual([10, 11, 12, 15, 39]);
  });

  it('returns events in chain order across contracts', async () => {
    const [a, b] = contracts(2);
    const source = new FakeSource(HEALTH, [contributed(b!, 20), contributed(a!, 30), contributed(b!, 40)]);

    const got = await fetchEvents(source, [a!, b!], 10, 100);

    expect(got.map((event) => event.ledger)).toEqual([20, 30, 40]);
  });
});
