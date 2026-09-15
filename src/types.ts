/**
 * Shapes shared across the indexer. `State` is what persists between runs, as
 * state.json in the data directory; every published file is derived from it.
 */

export type ContractKind = 'registry' | 'program' | 'attest' | 'record' | 'policy_spend';

/** The singleton contracts of one deployment, as milepost's packages/testnet.json records them. */
export interface Deployment {
  network: string;
  registry: string;
  attest: string;
  record: string;
  policy_spend: string;
  /**
   * Latest ledger before the first contract was deployed, so no event of this
   * contract set is older. Absent for deployments made before deploy.sh
   * recorded it.
   */
  deployed_ledger?: number;
}

/** A contract event decoded against its contract's spec. */
export interface IndexedEvent {
  /** RPC event id. Zero-padded, so string order is chain order. */
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  contractId: string;
  kind: ContractKind;
  /** The event struct's name in the contract, e.g. `Awarded`. */
  name: string;
  /**
   * Decoded params keyed by field name: addresses as strings, u32 as number,
   * i128 and u64 as bigint, BytesN as Buffer, structs as objects, enums as
   * `{ tag }`.
   */
  data: Record<string, unknown>;
}

export interface ProgrammeRecord {
  id: string;
  /**
   * From the registry's `ProgrammeCreated` event, the only place a name is
   * recorded. Null for a programme found through the registry whose creation
   * is older than the RPC's retention window.
   */
  name: string | null;
  creator: string | null;
  createdLedger: number | null;
}

export interface AwardRecord {
  recipient: string;
  /** i128 amounts as decimal strings: JSON has no integer type wide enough. */
  granted: string;
  released: string;
  tranches: number;
  tranchesReleased: number;
  payee: string;
  mode: string;
  /** Ledger of the event this record was last taken from. */
  updatedLedger: number;
}

export interface State {
  version: 1;
  network: string;
  registry: string;
  /** First ledger this state has read. */
  fromLedger: number;
  /** Next ledger to read. Every event below it has been applied. */
  nextLedger: number;
  /** True when reading started at or before the deployment, so nothing was missed at the start. */
  complete: boolean;
  /** True once a run found `nextLedger` already outside RPC retention: events were lost. Stays true until a reset. */
  gap: boolean;
  /** Registry nonce last reconciled against `programmes`. */
  registryNonce: number;
  programmes: Record<string, ProgrammeRecord>;
  /** programme id → recipient → award */
  awards: Record<string, Record<string, AwardRecord>>;
  /** `<kind>:<EventName>` → events seen with no handler. The work still to do. */
  unhandledEvents: Record<string, number>;
}
