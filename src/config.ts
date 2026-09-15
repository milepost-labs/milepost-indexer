import { readFile } from 'node:fs/promises';
import { StrKey } from '@stellar/stellar-sdk';
import type { Deployment } from './types.ts';

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  /** URL or local path of the deployment file listing the singleton contract ids. */
  deployment: string;
}

export const TESTNET: NetworkConfig = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  // Read from milepost on every run, so a redeploy after a testnet reset
  // reaches the indexer without a change to this repository.
  deployment: 'https://raw.githubusercontent.com/milepost-labs/milepost/main/packages/testnet.json',
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): NetworkConfig {
  return {
    rpcUrl: env.MILEPOST_RPC_URL || TESTNET.rpcUrl,
    networkPassphrase: TESTNET.networkPassphrase,
    deployment: env.MILEPOST_DEPLOYMENT || TESTNET.deployment,
  };
}

export async function loadDeployment(location: string): Promise<Deployment> {
  const text = /^https?:\/\//.test(location) ? await fetchText(location) : await readFile(location, 'utf8');
  return parseDeployment(JSON.parse(text), location);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetching ${url}: HTTP ${response.status}`);
  return response.text();
}

export function parseDeployment(value: unknown, source = 'deployment'): Deployment {
  if (typeof value !== 'object' || value === null) throw new Error(`${source}: expected a JSON object`);
  const fields = value as Record<string, unknown>;

  const network = fields.network;
  if (typeof network !== 'string' || network === '') throw new Error(`${source}: missing "network"`);

  const contract = (key: string): string => {
    const id = fields[key];
    if (typeof id !== 'string' || !StrKey.isValidContract(id)) throw new Error(`${source}: "${key}" is not a contract id`);
    return id;
  };

  const deployment: Deployment = {
    network,
    registry: contract('registry'),
    attest: contract('attest'),
    record: contract('record'),
    policy_spend: contract('policy_spend'),
  };

  const deployed = fields.deployed_ledger;
  if (deployed !== undefined) {
    if (typeof deployed !== 'number' || !Number.isInteger(deployed) || deployed <= 0) {
      throw new Error(`${source}: "deployed_ledger" must be a positive integer`);
    }
    deployment.deployed_ledger = deployed;
  }
  return deployment;
}
