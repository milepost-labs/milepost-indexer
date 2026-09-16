import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { indexPage } from '../src/indexPage.ts';
import { OUTPUT_VERSION, writeOutputs } from '../src/outputs.ts';
import type { State } from '../src/types.ts';
import { accountAddress, contractAddress } from './helpers/addresses.ts';

const PROGRAMME = contractAddress(31);
const CREATOR = accountAddress(20);
const INDEXED_AT = '2026-09-15T12:00:00.000Z';

function state(overrides: Partial<State> = {}): State {
  return {
    version: 1,
    network: 'testnet',
    registry: contractAddress(1),
    fromLedger: 4697201,
    nextLedger: 4698281,
    complete: true,
    gap: false,
    registryNonce: 1,
    programmes: {
      [PROGRAMME]: { id: PROGRAMME, name: 'Clinic fund', creator: CREATOR, createdLedger: 4697285 },
    },
    awards: {},
    unhandledEvents: { 'program:Reviewed': 6 },
    ...overrides,
  };
}

const page = (overrides: Partial<State> = {}): string =>
  indexPage(state(overrides), { indexedAt: INDEXED_AT, version: OUTPUT_VERSION });

describe('indexPage', () => {
  it('links to the published files, including each programme’s awards', () => {
    const html = page();

    expect(html).toContain(`href="${OUTPUT_VERSION}/meta.json"`);
    expect(html).toContain(`href="${OUTPUT_VERSION}/programmes.json"`);
    expect(html).toContain(`href="${OUTPUT_VERSION}/programmes/${PROGRAMME}/awards.json"`);
  });

  it('shows how fresh the index is and what it covers', () => {
    const html = page();

    expect(html).toContain(INDEXED_AT);
    expect(html).toContain('4697201');
    expect(html).toContain('4698280');
  });

  it('escapes a programme name, which is text from whoever created it', () => {
    const hostile = '<script>alert(1)</script>';
    const html = page({
      programmes: { [PROGRAMME]: { id: PROGRAMME, name: hostile, creator: CREATOR, createdLedger: 1 } },
    });

    expect(html).not.toContain(hostile);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('names a programme whose creation predates the index', () => {
    const html = page({
      programmes: { [PROGRAMME]: { id: PROGRAMME, name: null, creator: null, createdLedger: null } },
    });

    expect(html).toContain('Unnamed programme');
  });

  it('says so when events were lost or the start was missed', () => {
    expect(page({ gap: true })).toMatch(/some are missing/i);
    expect(page({ complete: false })).toMatch(/started after the contracts were deployed/i);
    expect(page()).not.toMatch(/some are missing/i);
  });
});

describe('writeOutputs', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'milepost-indexer-page-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the page at the site root, beside the versioned files', async () => {
    await writeOutputs(dir, state(), { indexedAt: INDEXED_AT });

    const html = await readFile(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain('<title>Milepost index</title>');
    expect(html).toContain(`href="${OUTPUT_VERSION}/meta.json"`);
    await expect(readFile(path.join(dir, OUTPUT_VERSION, 'meta.json'), 'utf8')).resolves.toContain('"network"');
  });
});
