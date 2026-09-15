import { Client as RegistryClient } from '@milepost/registry';
import { rpc } from '@stellar/stellar-sdk';
import type { NetworkConfig } from './config.ts';
import type { Deployment } from './types.ts';

/** Everything a run reads from the network. Tests substitute an in-memory one. */
export interface ChainSource {
  getHealth(): Promise<{ latestLedger: number; oldestLedger: number }>;
  getEvents(request: rpc.Api.GetEventsRequest): Promise<rpc.Api.GetEventsResponse>;
  registryNonce(): Promise<number>;
  programmeAddress(n: number): Promise<string>;
}

export function rpcSource(config: NetworkConfig, deployment: Deployment): ChainSource {
  const server = new rpc.Server(config.rpcUrl);
  const registry = new RegistryClient({
    contractId: deployment.registry,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
  return {
    getHealth: () => withRetry('getHealth', () => server.getHealth()),
    getEvents: (request) => withRetry('getEvents', () => server.getEvents(request)),
    registryNonce: () => withRetry('registry.nonce', async () => Number((await registry.nonce()).result)),
    programmeAddress: (n) =>
      withRetry('registry.programme_address', async () => (await registry.programme_address({ n: BigInt(n) })).result),
  };
}

const ATTEMPTS = 3;

/**
 * Public RPC endpoints drop the odd request. A scheduled run that fails on one
 * waits ten minutes for the next, so a couple of quick retries are worth it;
 * anything that keeps failing still fails the run.
 */
async function withRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw new Error(`${label} failed after ${ATTEMPTS} attempts`, { cause: error });
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
}
