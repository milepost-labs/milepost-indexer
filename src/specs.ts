import { Client as AttestClient } from '@milepost/attest';
import { Client as PolicySpendClient } from '@milepost/policy-spend';
import { Client as ProgramClient } from '@milepost/program';
import { Client as RecordClient } from '@milepost/record';
import { Client as RegistryClient } from '@milepost/registry';
import { StrKey, type contract } from '@stellar/stellar-sdk';
import { TESTNET } from './config.ts';
import type { ContractKind } from './types.ts';

export type Specs = Record<ContractKind, contract.Spec>;

/**
 * The spec each generated client embeds, which is what decodes events. A spec
 * is the same for every instance of a contract, so the options below only
 * satisfy the constructor; nothing here makes a call.
 */
export function loadSpecs(): Specs {
  const options = {
    contractId: StrKey.encodeContract(Buffer.alloc(32)),
    networkPassphrase: TESTNET.networkPassphrase,
    rpcUrl: TESTNET.rpcUrl,
  };
  return {
    registry: new RegistryClient(options).spec,
    program: new ProgramClient(options).spec,
    attest: new AttestClient(options).spec,
    record: new RecordClient(options).spec,
    policy_spend: new PolicySpendClient(options).spec,
  };
}
