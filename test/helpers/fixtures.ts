import type { rpc } from '@stellar/stellar-sdk';
import type { ContractKind } from '../../src/types.ts';

/** What scripts/record-fixture.ts writes: raw getEvents events for a ledger range. */
export interface Fixture {
  network: string;
  from: number;
  /** Exclusive. */
  to: number;
  contracts: Record<string, ContractKind>;
  events: rpc.Api.RawEventResponse[];
}
