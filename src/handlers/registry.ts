import type { Handler } from '../reduce.ts';
import type { ProgrammeRecord, State } from '../types.ts';
import { asString } from './values.ts';

/** The record for a programme, created empty the first time it is seen. */
export function ensureProgramme(state: State, id: string): ProgrammeRecord {
  return (state.programmes[id] ??= { id, name: null, creator: null, createdLedger: null });
}

export const registryHandlers: Record<string, Handler> = {
  // Emitted by the registry's `create`. The programme contract emits its own
  // `ProgrammeCreated` with the config; that one is `program:ProgrammeCreated`.
  'registry:ProgrammeCreated': (state, event) => {
    const programme = ensureProgramme(state, asString(event.data.programme, 'programme'));
    programme.name = asString(event.data.name, 'name');
    programme.creator = asString(event.data.creator, 'creator');
    programme.createdLedger = event.ledger;
  },
};
