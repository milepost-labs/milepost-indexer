import type { rpc } from '@stellar/stellar-sdk';
import type { ChainSource } from './source.ts';

/** Limits the RPC enforces on one getEvents request. */
export const MAX_FILTERS = 5;
export const MAX_CONTRACTS_PER_FILTER = 5;

export interface FetchOptions {
  /** Events per page. The RPC allows 1–10,000. */
  pageLimit?: number;
  /** Ledgers covered by one ranged request. */
  ledgerWindow?: number;
}

/** Event ids are zero-padded, so comparing them as strings orders events as the chain did. */
export function compareEventIds(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Splits contract ids into the fewest getEvents requests the RPC accepts. */
export function filterBatches(contractIds: readonly string[]): rpc.Api.EventFilter[][] {
  const filters: rpc.Api.EventFilter[] = [];
  for (let i = 0; i < contractIds.length; i += MAX_CONTRACTS_PER_FILTER) {
    filters.push({ type: 'contract', contractIds: contractIds.slice(i, i + MAX_CONTRACTS_PER_FILTER) });
  }
  const batches: rpc.Api.EventFilter[][] = [];
  for (let i = 0; i < filters.length; i += MAX_FILTERS) {
    batches.push(filters.slice(i, i + MAX_FILTERS));
  }
  return batches;
}

/**
 * Every event `contractIds` emitted in ledgers [from, to), in chain order.
 *
 * Each ledger window starts as a ranged request. A full page continues by
 * cursor, which the RPC does not bound by the window's end, so events at or
 * past the end are dropped here and read again by the next window. A page
 * shorter than the limit means the window has nothing more.
 */
export async function fetchEvents(
  source: ChainSource,
  contractIds: readonly string[],
  from: number,
  to: number,
  options: FetchOptions = {},
): Promise<rpc.Api.EventResponse[]> {
  const pageLimit = options.pageLimit ?? 10_000;
  const ledgerWindow = options.ledgerWindow ?? 10_000;
  const byId = new Map<string, rpc.Api.EventResponse>();

  for (const filters of filterBatches(contractIds)) {
    for (let start = from; start < to; start += ledgerWindow) {
      const end = Math.min(start + ledgerWindow, to);
      let page = await source.getEvents({ filters, startLedger: start, endLedger: end, limit: pageLimit });
      for (;;) {
        let pastEnd = false;
        for (const event of page.events) {
          if (event.ledger >= end) {
            pastEnd = true;
            break;
          }
          if (event.ledger >= start) byId.set(event.id, event);
        }
        if (pastEnd || page.events.length < pageLimit) break;
        page = await source.getEvents({ filters, cursor: page.cursor, limit: pageLimit });
      }
    }
  }

  return [...byId.values()].sort(compareEventIds);
}
