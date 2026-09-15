import path from 'node:path';
import type { rpc } from '@stellar/stellar-sdk';
import { contractIdOf, decodeEvent } from './decode.ts';
import { compareEventIds, fetchEvents, type FetchOptions } from './fetch.ts';
import { ensureProgramme } from './handlers/registry.ts';
import { asString } from './handlers/values.ts';
import { writeOutputs } from './outputs.ts';
import { applyEvents } from './reduce.ts';
import type { ChainSource } from './source.ts';
import type { Specs } from './specs.ts';
import { emptyState, readState, writeState } from './state.ts';
import type { ContractKind, Deployment, IndexedEvent, State } from './types.ts';

/**
 * Ledgers kept clear of the RPC's oldest ledger. It moves forward while a run
 * is in progress and differs slightly between load-balanced nodes, and a
 * request that starts below it is refused.
 */
export const RETENTION_MARGIN = 100;

/**
 * How far the network's latest ledger may sit below this index before that
 * counts as a network reset. Smaller gaps are a lagging RPC node.
 */
export const RESET_MARGIN = 1_000;

export interface RunDeps {
  source: ChainSource;
  deployment: Deployment;
  specs: Specs;
  now?: () => Date;
  log?: (message: string) => void;
  fetchOptions?: FetchOptions;
}

export interface RunOptions {
  dataDir: string;
  /** Discard saved state and rebuild from the start. */
  reset?: boolean;
  /** Stop before this ledger instead of the latest one. */
  toLedger?: number;
}

export interface RunResult {
  /** 1 when this run found events lost to retention, so the scheduled job fails and someone is told. */
  exitCode: 0 | 1;
  state: State;
  eventsApplied: number;
}

/** One pass: read from the saved position to the latest ledger, apply, and write state and outputs. */
export async function run(deps: RunDeps, options: RunOptions): Promise<RunResult> {
  const { source, deployment, specs } = deps;
  const log = deps.log ?? (() => {});
  const health = await source.getHealth();
  const oldest = health.oldestLedger + RETENTION_MARGIN;

  let state = options.reset ? undefined : await readState(options.dataDir);
  if (options.reset) log('reset requested: rebuilding');
  if (state && (state.network !== deployment.network || state.registry !== deployment.registry)) {
    log(`deployment changed (registry ${state.registry} → ${deployment.registry}): rebuilding`);
    state = undefined;
  }
  if (state && health.latestLedger + RESET_MARGIN < state.nextLedger) {
    log(`network is at ledger ${health.latestLedger}, far behind this index at ${state.nextLedger}: treating it as a network reset`);
    state = undefined;
  }
  if (!state) {
    const deployed = deployment.deployed_ledger;
    const from = Math.max(deployed ?? oldest, oldest);
    const complete = deployed !== undefined && deployed >= oldest;
    state = emptyState(deployment, from, complete);
    log(`starting at ledger ${from}${complete ? '' : ' (the deployment is older than RPC retention, so earlier events are missing)'}`);
  }

  let gapFound = false;
  if (state.nextLedger < oldest) {
    log(`gap: ledgers ${state.nextLedger}–${oldest - 1} are no longer retained by the RPC, so their events are lost`);
    state.gap = true;
    state.nextLedger = oldest;
    gapFound = true;
  }

  const from = state.nextLedger;
  // The latest ledger itself is left for the next run: a different node behind
  // the load balancer may not have it yet.
  const to = Math.min(options.toLedger ?? health.latestLedger, health.latestLedger);
  let eventsApplied = 0;

  if (to > from) {
    const coreKinds = new Map<string, ContractKind>([
      [deployment.registry, 'registry'],
      [deployment.attest, 'attest'],
      [deployment.record, 'record'],
      [deployment.policy_spend, 'policy_spend'],
    ]);
    const core = decodeAll(await fetchEvents(source, [...coreKinds.keys()], from, to, deps.fetchOptions), (id) => coreKinds.get(id), specs);

    // Programmes created in this range must have their own events read over the
    // same range, so they are known before the second fetch.
    for (const event of core) {
      if (event.kind === 'registry' && event.name === 'ProgrammeCreated') {
        ensureProgramme(state, asString(event.data.programme, 'ProgrammeCreated.programme'));
      }
    }
    await reconcileRegistry(source, state, log);

    const programmeIds = Object.keys(state.programmes).sort();
    const programmeSet = new Set(programmeIds);
    const programmes = decodeAll(
      await fetchEvents(source, programmeIds, from, to, deps.fetchOptions),
      (id) => (programmeSet.has(id) ? 'program' : undefined),
      specs,
    );

    const events = [...core, ...programmes].sort(compareEventIds);
    applyEvents(state, events);
    eventsApplied = events.length;
    state.nextLedger = to;
  }

  await writeState(options.dataDir, state);
  await writeOutputs(path.join(options.dataDir, 'public'), state, {
    indexedAt: (deps.now?.() ?? new Date()).toISOString(),
  });
  return { exitCode: gapFound ? 1 : 0, state, eventsApplied };
}

function decodeAll(
  events: readonly rpc.Api.EventResponse[],
  kindOf: (contractId: string) => ContractKind | undefined,
  specs: Specs,
): IndexedEvent[] {
  return events.flatMap((event) => {
    // Events from a call that failed were rolled back with it.
    if (!event.inSuccessfulContractCall) return [];
    const id = contractIdOf(event);
    const kind = id === undefined ? undefined : kindOf(id);
    return kind ? [decodeEvent(event, kind, specs)] : [];
  });
}

/**
 * Adds programmes the registry has deployed that no event announced — those
 * created before the RPC's retention window. The registry numbers programmes
 * from zero, so only indices past the last reconciled nonce are read.
 */
async function reconcileRegistry(source: ChainSource, state: State, log: (message: string) => void): Promise<void> {
  const nonce = await source.registryNonce();
  for (let n = state.registryNonce; n < nonce; n++) {
    const id = await source.programmeAddress(n);
    if (!state.programmes[id]) {
      ensureProgramme(state, id);
      log(`programme #${n} ${id} found through the registry`);
    }
  }
  state.registryNonce = Math.max(state.registryNonce, nonce);
}
