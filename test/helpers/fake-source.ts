import type { rpc } from '@stellar/stellar-sdk';
import { compareEventIds, MAX_CONTRACTS_PER_FILTER, MAX_FILTERS } from '../../src/fetch.ts';
import type { ChainSource } from '../../src/source.ts';
import { parseRaw } from './events.ts';

export interface Health {
  latestLedger: number;
  oldestLedger: number;
}

/**
 * An in-memory RPC that enforces the limits the real one does, so code that
 * builds a request the network would refuse fails in tests too. Tests change
 * `health`, `events` and `programmes` between runs to move the chain along.
 */
export class FakeSource implements ChainSource {
  health: Health;
  events: rpc.Api.RawEventResponse[];
  /** Programme addresses by registry index. */
  programmes: string[];
  readonly calls: rpc.Api.GetEventsRequest[] = [];

  constructor(health: Health, events: rpc.Api.RawEventResponse[] = [], programmes: string[] = []) {
    this.health = health;
    this.events = events;
    this.programmes = programmes;
  }

  async getHealth(): Promise<Health> {
    return { ...this.health };
  }

  async registryNonce(): Promise<number> {
    return this.programmes.length;
  }

  async programmeAddress(n: number): Promise<string> {
    const id = this.programmes[n];
    if (id === undefined) throw new Error(`registry has no programme #${n}`);
    return id;
  }

  async getEvents(request: rpc.Api.GetEventsRequest): Promise<rpc.Api.GetEventsResponse> {
    this.calls.push(request);
    if (request.filters.length > MAX_FILTERS) throw new Error(`getEvents: more than ${MAX_FILTERS} filters`);
    for (const filter of request.filters) {
      if ((filter.contractIds?.length ?? 0) > MAX_CONTRACTS_PER_FILTER) {
        throw new Error(`getEvents: more than ${MAX_CONTRACTS_PER_FILTER} contract ids in a filter`);
      }
    }

    const contracts = new Set(request.filters.flatMap((filter) => filter.contractIds ?? []));
    let matching = this.events.filter((event) => contracts.has(event.contractId)).sort(compareEventIds);

    const { startLedger, endLedger, cursor } = request;
    if (cursor !== undefined) {
      // Like the RPC, a cursor continues past any end ledger.
      matching = matching.filter((event) => event.id > cursor);
    } else if (startLedger !== undefined) {
      if (startLedger < this.health.oldestLedger || startLedger > this.health.latestLedger) {
        throw new Error(`getEvents: startLedger ${startLedger} is outside retention`);
      }
      matching = matching.filter((event) => event.ledger >= startLedger && (endLedger === undefined || event.ledger < endLedger));
    }

    const page = matching.slice(0, request.limit ?? 100);
    return {
      ...this.health,
      latestLedgerCloseTime: '0',
      oldestLedgerCloseTime: '0',
      events: parseRaw(page),
      cursor: page.at(-1)?.id ?? cursor ?? '',
    };
  }
}
