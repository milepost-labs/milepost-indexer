import { awardHandlers } from './handlers/awards.ts';
import { registryHandlers } from './handlers/registry.ts';
import type { IndexedEvent, State } from './types.ts';

/**
 * Applies one decoded event to the state. Must depend only on the state and
 * the event: a reset replays the same events and has to arrive at the same
 * result.
 */
export type Handler = (state: State, event: IndexedEvent) => void;

/** Keyed `<kind>:<EventName>`. docs/adding-an-event.md walks through adding one. */
export const handlers: Readonly<Record<string, Handler>> = {
  ...registryHandlers,
  ...awardHandlers,
};

export function eventKey(event: IndexedEvent): string {
  return `${event.kind}:${event.name}`;
}

export function applyEvents(
  state: State,
  events: readonly IndexedEvent[],
  table: Readonly<Record<string, Handler>> = handlers,
): void {
  for (const event of events) {
    const key = eventKey(event);
    const handler = Object.hasOwn(table, key) ? table[key] : undefined;
    if (handler) handler(state, event);
    else state.unhandledEvents[key] = (state.unhandledEvents[key] ?? 0) + 1;
  }
}
