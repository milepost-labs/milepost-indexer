import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UNDECODABLE } from '../src/decode.ts';
import { RETENTION_MARGIN, run } from '../src/run.ts';
import { loadSpecs } from '../src/specs.ts';
import { FakeSource } from './helpers/fake-source.ts';
import { fixtureDeployment, loadFixture } from './helpers/fixtures.ts';

// test/fixtures/seed-scenario.json holds every event from milepost's
// scripts/seed.sh and scripts/seed-review.sh, run against the testnet
// deployment of 2026-09-15: one programme, two funded applications, three
// reviewers, two awards, an attested milestone, one released tranche and a
// directed spend. The expected awards below are what the programme's
// `get_award` returned on-chain after that run.
const PROGRAMME = 'CD6X33SKLUEMANS67ID3LJL572FFGERMMJCIFRW7P7EKZQLH35XT67C6';
const CREATOR = 'GCS7774GF6OHIEXCXMUGI56RLOPHE3SEOK4F2CEMQYFXALNEYLK5IGHX';
const ADA = 'GAH3D4RM45ETE4W7VDRCWZBPRPT63CJXAGXFYVBC2FGANBZTS4OTKXCA';
const KOFI = 'GCJTOXX6PUK7WTK6LWRUQEWLYZ3QITOE2Q63JJJOJLWVGAYKZLSS5YNZ';
const SCHOOL = 'GAUHWES2VEBGS5IWDET2IUYZXG3HCXOV7QIMXWM3AH3KHXE4HWJOSC5A';

let dataDir: string;
beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'milepost-indexer-fixture-'));
});
afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const published = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(path.join(dataDir, 'public', 'v1', file), 'utf8'));

describe('the recorded seed scenario', () => {
  it('decodes every event and publishes what the contracts report', async () => {
    const fixture = await loadFixture('seed-scenario');
    const source = new FakeSource(
      { latestLedger: fixture.to, oldestLedger: fixture.from - RETENTION_MARGIN },
      fixture.events,
      [PROGRAMME],
    );

    const result = await run(
      { source, deployment: fixtureDeployment(fixture), specs: loadSpecs(), now: () => new Date(0) },
      { dataDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.eventsApplied).toBe(fixture.events.length);
    // An event the published bindings cannot decode would mean they no longer
    // match the deployed contracts.
    expect(Object.keys(result.state.unhandledEvents).filter((key) => key.endsWith(UNDECODABLE))).toEqual([]);

    expect(await published('programmes.json')).toEqual([
      { id: PROGRAMME, name: 'Community health worker stipend 2026', creator: CREATOR, createdLedger: 4697285 },
    ]);
    expect(await published(`programmes/${PROGRAMME}/awards.json`)).toEqual([
      { recipient: ADA, granted: '3000000000', released: '1000000000', tranches: 3, tranchesReleased: 1, payee: ADA, mode: 'Allocated', updatedLedger: 4697367 },
      { recipient: KOFI, granted: '800000000', released: '0', tranches: 3, tranchesReleased: 0, payee: SCHOOL, mode: 'Direct', updatedLedger: 4697363 },
    ]);
  });

  it('counts the events that still have no handler', async () => {
    const fixture = await loadFixture('seed-scenario');
    const source = new FakeSource({ latestLedger: fixture.to, oldestLedger: fixture.from - RETENTION_MARGIN }, fixture.events, [PROGRAMME]);

    const result = await run({ source, deployment: fixtureDeployment(fixture), specs: loadSpecs() }, { dataDir });

    expect(result.state.unhandledEvents).toEqual({
      'attest:Attested': 1,
      'attest:SchemaRegistered': 1,
      'program:AllocationChanged': 1,
      'program:Applied': 2,
      'program:Contributed': 2,
      'program:Directed': 1,
      'program:PayeeChanged': 1,
      'program:ProgrammeCreated': 1,
      'program:Reviewed': 6,
      'record:AdminChanged': 2,
      'record:Credited': 1,
      'record:WriterChanged': 1,
      'registry:ConfigChanged': 1,
    });
  });
});
