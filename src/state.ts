import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from './json.ts';
import type { Deployment, State } from './types.ts';

export const STATE_FILE = 'state.json';

/**
 * The collections every state has. Adding one means adding its empty value
 * here, so a state saved before it existed still loads.
 */
function collections(): Pick<State, 'programmes' | 'awards' | 'unhandledEvents'> {
  return { programmes: {}, awards: {}, unhandledEvents: {} };
}

export function emptyState(deployment: Deployment, fromLedger: number, complete: boolean): State {
  return {
    version: 1,
    network: deployment.network,
    registry: deployment.registry,
    fromLedger,
    nextLedger: fromLedger,
    complete,
    gap: false,
    registryNonce: 0,
    ...collections(),
  };
}

export async function readState(dataDir: string): Promise<State | undefined> {
  let text: string;
  try {
    text = await readFile(path.join(dataDir, STATE_FILE), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const saved = JSON.parse(text) as Partial<State>;
  if (saved.version !== 1) {
    throw new Error(`${STATE_FILE} has version ${String(saved.version)}, expected 1; run with --reset`);
  }
  return { ...collections(), ...saved } as State;
}

export async function writeState(dataDir: string, state: State): Promise<void> {
  await writeJson(path.join(dataDir, STATE_FILE), state);
}
