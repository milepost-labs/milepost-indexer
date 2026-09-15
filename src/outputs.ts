import { rm } from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from './json.ts';
import type { State } from './types.ts';

/** Every published path starts with this, so a breaking change can ship as v2 beside it. */
export const OUTPUT_VERSION = 'v1';

export interface PublishedFile {
  /** Relative to public/<version>/. */
  path: string;
  body: unknown;
}

export interface OutputContext {
  indexedAt: string;
}

/** Derives published files from the state. docs/outputs.md documents each one. */
export type Output = (state: State, context: OutputContext) => PublishedFile[];

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const meta: Output = (state, { indexedAt }) => [
  {
    path: 'meta.json',
    body: {
      network: state.network,
      registry: state.registry,
      fromLedger: state.fromLedger,
      indexedToLedger: state.nextLedger - 1,
      indexedAt,
      complete: state.complete,
      gap: state.gap,
      unhandledEvents: Object.fromEntries(
        Object.entries(state.unhandledEvents).sort(([a], [b]) => compare(a, b)),
      ),
    },
  },
];

export const programmes: Output = (state) => [
  {
    path: 'programmes.json',
    body: Object.values(state.programmes).sort((a, b) => compare(a.id, b.id)),
  },
];

// One file per known programme, empty when it has no awards, so a programme
// the index knows about never answers 404.
export const awards: Output = (state) =>
  Object.keys(state.programmes)
    .sort(compare)
    .map((id) => ({
      path: `programmes/${id}/awards.json`,
      body: Object.values(state.awards[id] ?? {}).sort((a, b) => compare(a.recipient, b.recipient)),
    }));

export const outputs: readonly Output[] = [meta, programmes, awards];

export async function writeOutputs(
  publicDir: string,
  state: State,
  context: OutputContext,
  list: readonly Output[] = outputs,
): Promise<void> {
  const root = path.join(publicDir, OUTPUT_VERSION);
  // Rebuilt whole on every run, so nothing survives whose source is gone, such
  // as a programme's files after a reset.
  await rm(root, { recursive: true, force: true });
  for (const output of list) {
    for (const file of output(state, context)) {
      await writeJson(path.join(root, file.path), file.body);
    }
  }
}
