import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run, type RunDeps } from '../src/run.ts';
import { loadSpecs } from '../src/specs.ts';
import type { Deployment } from '../src/types.ts';
import { accountAddress, contractAddress } from './helpers/addresses.ts';
import { encodeEvent } from './helpers/events.ts';
import { FakeSource } from './helpers/fake-source.ts';

const specs = loadSpecs();
const REGISTRY = contractAddress(1);
const deployment: Deployment = {
  network: 'testnet',
  registry: REGISTRY,
  attest: contractAddress(2),
  record: contractAddress(3),
  policy_spend: contractAddress(4),
  deployed_ledger: 500,
};
const CREATOR = accountAddress(20);
const P1 = contractAddress(31);
const ALICE = accountAddress(41);
const PAYEE = accountAddress(51);
const INDEXED_AT = '2026-09-15T12:00:00.000Z';

function programmeCreated(programme: string, ledger: number, name = 'Clinic fund') {
  return encodeEvent(specs.registry, 'ProgrammeCreated', { programme, creator: CREATOR, name }, { contractId: REGISTRY, ledger });
}

function award(recipient: string, granted: bigint, released = 0n, tranchesReleased = 0) {
  return { recipient, granted, released, tranches: 2, tranches_released: tranchesReleased, payee: PAYEE, mode: { tag: 'Direct' } };
}

function awarded(programme: string, ledger: number, recipient: string, granted: bigint, options: { inSuccessfulContractCall?: boolean } = {}) {
  return encodeEvent(specs.program, 'Awarded', { recipient, award: award(recipient, granted) }, { contractId: programme, ledger, ...options });
}

function released(programme: string, ledger: number, recipient: string, amount: bigint, after: ReturnType<typeof award>) {
  return encodeEvent(
    specs.program,
    'Released',
    { recipient, payee: PAYEE, amount, attestation: Buffer.alloc(32, 7), award: after },
    { contractId: programme, ledger },
  );
}

let dataDir: string;
beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'milepost-indexer-'));
});
afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const deps = (source: FakeSource, overrides: Partial<RunDeps> = {}): RunDeps => ({
  source,
  deployment,
  specs,
  now: () => new Date(INDEXED_AT),
  ...overrides,
});

const published = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(dataDir, 'public', 'v1', file), 'utf8'));

describe('run: publishing', () => {
  it('starts at the deploy ledger and publishes meta, programmes and awards', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600), awarded(P1, 700, ALICE, 500n)], [P1]);

    const result = await run(deps(source), { dataDir });

    expect(result.exitCode).toBe(0);
    expect(result.eventsApplied).toBe(2);
    expect(await published('meta.json')).toEqual({
      network: 'testnet',
      registry: REGISTRY,
      fromLedger: 500,
      indexedToLedger: 999,
      indexedAt: INDEXED_AT,
      complete: true,
      gap: false,
      unhandledEvents: {},
    });
    expect(await published('programmes.json')).toEqual([{ id: P1, name: 'Clinic fund', creator: CREATOR, createdLedger: 600 }]);
    expect(await published(`programmes/${P1}/awards.json`)).toEqual([
      { recipient: ALICE, granted: '500', released: '0', tranches: 2, tranchesReleased: 0, payee: PAYEE, mode: 'Direct', updatedLedger: 700 },
    ]);
  });

  it('updates an award from a later release', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [
      programmeCreated(P1, 600),
      awarded(P1, 700, ALICE, 500n),
      released(P1, 800, ALICE, 250n, award(ALICE, 500n, 250n, 1)),
    ], [P1]);

    await run(deps(source), { dataDir });

    expect(await published(`programmes/${P1}/awards.json`)).toEqual([
      { recipient: ALICE, granted: '500', released: '250', tranches: 2, tranchesReleased: 1, payee: PAYEE, mode: 'Direct', updatedLedger: 800 },
    ]);
  });

  it('reads a new programme’s events in the same run that discovers it', async () => {
    // The registry nonce has not caught up, so only the event announces P1.
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600), awarded(P1, 700, ALICE, 500n)], []);

    await run(deps(source), { dataDir });

    expect(await published(`programmes/${P1}/awards.json`)).toHaveLength(1);
  });

  it('finds a programme created before retention through the registry', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [awarded(P1, 700, ALICE, 500n)], [P1]);

    await run(deps(source), { dataDir });

    expect(await published('programmes.json')).toEqual([{ id: P1, name: null, creator: null, createdLedger: null }]);
    expect(await published(`programmes/${P1}/awards.json`)).toHaveLength(1);
  });

  it('counts events that have no handler', async () => {
    const contribution = encodeEvent(specs.program, 'Contributed', { donor: ALICE, amount: 10n }, { contractId: P1, ledger: 650 });
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600), contribution], [P1]);

    await run(deps(source), { dataDir });

    expect(await published('meta.json')).toMatchObject({ unhandledEvents: { 'program:Contributed': 1 } });
  });

  it('ignores events from failed contract calls', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [
      programmeCreated(P1, 600),
      awarded(P1, 700, ALICE, 500n, { inSuccessfulContractCall: false }),
    ], [P1]);

    await run(deps(source), { dataDir });

    expect(await published(`programmes/${P1}/awards.json`)).toEqual([]);
  });
});

describe('run: position', () => {
  it('continues from where the last run stopped', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600)], [P1]);
    await run(deps(source), { dataDir });

    source.events.push(awarded(P1, 1_200, ALICE, 500n));
    source.health = { latestLedger: 1_500, oldestLedger: 1 };
    source.calls.length = 0;
    const second = await run(deps(source), { dataDir });

    expect(second.eventsApplied).toBe(1);
    expect(second.state.nextLedger).toBe(1_500);
    expect(source.calls[0]).toMatchObject({ startLedger: 1_000 });
    expect(await published(`programmes/${P1}/awards.json`)).toHaveLength(1);
  });

  it('stops before --to-ledger', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600), awarded(P1, 800, ALICE, 500n)], [P1]);

    const result = await run(deps(source), { dataDir, toLedger: 700 });

    expect(result.state.nextLedger).toBe(700);
    expect(await published(`programmes/${P1}/awards.json`)).toEqual([]);
  });

  it('starts inside retention and marks the index incomplete without a recorded deploy ledger', async () => {
    const source = new FakeSource({ latestLedger: 2_000, oldestLedger: 300 });

    const result = await run(deps(source, { deployment: { ...deployment, deployed_ledger: undefined } }), { dataDir });

    expect(result.state).toMatchObject({ fromLedger: 400, complete: false });
  });

  it('marks the index incomplete when the deployment is older than retention', async () => {
    const source = new FakeSource({ latestLedger: 2_000, oldestLedger: 900 });

    const result = await run(deps(source), { dataDir });

    expect(result.state).toMatchObject({ fromLedger: 1_000, complete: false });
  });
});

describe('run: gaps and resets', () => {
  it('reports a gap once when the saved position has left retention, and keeps the flag', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 });
    await run(deps(source), { dataDir });

    source.health = { latestLedger: 9_000, oldestLedger: 5_000 };
    const gapRun = await run(deps(source), { dataDir });
    expect(gapRun.exitCode).toBe(1);
    expect(gapRun.state).toMatchObject({ gap: true, fromLedger: 500, nextLedger: 9_000 });
    expect(await published('meta.json')).toMatchObject({ gap: true });

    source.health = { latestLedger: 9_500, oldestLedger: 5_100 };
    const after = await run(deps(source), { dataDir });
    expect(after.exitCode).toBe(0);
    expect(after.state.gap).toBe(true);
  });

  it('rebuilds when the deployment has a different registry', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600)], [P1]);
    await run(deps(source), { dataDir });

    const redeployed = { ...deployment, registry: contractAddress(11), deployed_ledger: 900 };
    const result = await run(deps(new FakeSource({ latestLedger: 1_200, oldestLedger: 1 }), { deployment: redeployed }), { dataDir });

    expect(result.state).toMatchObject({ registry: redeployed.registry, fromLedger: 900, programmes: {} });
    expect(await published('programmes.json')).toEqual([]);
    await expect(published(`programmes/${P1}/awards.json`)).rejects.toThrow();
  });

  it('rebuilds when the network’s latest ledger falls far below the index', async () => {
    const source = new FakeSource({ latestLedger: 5_000, oldestLedger: 1 }, [programmeCreated(P1, 600)], [P1]);
    await run(deps(source), { dataDir });

    source.health = { latestLedger: 100, oldestLedger: 1 };
    const result = await run(deps(source), { dataDir });

    expect(result.state).toMatchObject({ fromLedger: 500, nextLedger: 500, programmes: {} });
  });

  it('does not mistake a lagging RPC node for a reset', async () => {
    const source = new FakeSource({ latestLedger: 5_000, oldestLedger: 1 }, [programmeCreated(P1, 600)], [P1]);
    await run(deps(source), { dataDir });

    source.health = { latestLedger: 4_990, oldestLedger: 1 };
    const result = await run(deps(source), { dataDir });

    expect(result.exitCode).toBe(0);
    expect(result.state).toMatchObject({ fromLedger: 500, nextLedger: 5_000 });
    expect(Object.keys(result.state.programmes)).toEqual([P1]);
  });

  it('rebuilds from the start with reset', async () => {
    const source = new FakeSource({ latestLedger: 1_000, oldestLedger: 1 }, [programmeCreated(P1, 600), awarded(P1, 700, ALICE, 500n)], [P1]);
    await run(deps(source), { dataDir });

    const result = await run(deps(source), { dataDir, reset: true });

    expect(result.eventsApplied).toBe(2);
    expect(result.state.fromLedger).toBe(500);
  });
});
