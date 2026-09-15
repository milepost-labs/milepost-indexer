import type { rpc } from '@stellar/stellar-sdk';
import type { Specs } from './specs.ts';
import type { ContractKind, IndexedEvent } from './types.ts';

/**
 * The name given to an event its contract's spec does not describe. Counted
 * like any unhandled event, so a rising count in meta.json means the published
 * bindings no longer match the deployed contracts.
 */
export const UNDECODABLE = '<undecodable>';

export function contractIdOf(event: rpc.Api.EventResponse): string | undefined {
  return event.contractId?.contractId();
}

export function decodeEvent(event: rpc.Api.EventResponse, kind: ContractKind, specs: Specs): IndexedEvent {
  const parsed = specs[kind].parseEvent(event.topic, event.value);
  return {
    id: event.id,
    ledger: event.ledger,
    ledgerClosedAt: event.ledgerClosedAt,
    txHash: event.txHash,
    contractId: contractIdOf(event) ?? '',
    kind,
    name: parsed?.name ?? UNDECODABLE,
    data: parsed?.data ?? {},
  };
}
