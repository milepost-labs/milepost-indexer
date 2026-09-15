import { readFile } from 'node:fs/promises';
import type { rpc } from '@stellar/stellar-sdk';
import type { ContractKind, Deployment } from '../../src/types.ts';

/** What scripts/record-fixture.ts writes: raw getEvents events for a ledger range. */
export interface Fixture {
  network: string;
  from: number;
  /** Exclusive. */
  to: number;
  contracts: Record<string, ContractKind>;
  events: rpc.Api.RawEventResponse[];
}

/** Reads `test/fixtures/<name>.json`. */
export async function loadFixture(name: string): Promise<Fixture> {
  return JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8')) as Fixture;
}

/** The deployment a fixture was recorded from, deployed at the first ledger it covers. */
export function fixtureDeployment(fixture: Fixture): Deployment {
  const contractOf = (kind: ContractKind): string => {
    const entry = Object.entries(fixture.contracts).find(([, contractKind]) => contractKind === kind);
    if (!entry) throw new Error(`fixture has no ${kind} contract`);
    return entry[0];
  };
  return {
    network: fixture.network,
    registry: contractOf('registry'),
    attest: contractOf('attest'),
    record: contractOf('record'),
    policy_spend: contractOf('policy_spend'),
    deployed_ledger: fixture.from,
  };
}
