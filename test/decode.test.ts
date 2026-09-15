import { xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { decodeEvent, UNDECODABLE } from '../src/decode.ts';
import { loadSpecs } from '../src/specs.ts';
import { accountAddress, contractAddress } from './helpers/addresses.ts';
import { encodeEvent, parseRaw } from './helpers/events.ts';

const specs = loadSpecs();
const REGISTRY = contractAddress(1);
const PROGRAMME = contractAddress(31);
const CREATOR = accountAddress(20);
const RECIPIENT = accountAddress(41);
const PAYEE = accountAddress(51);

describe('loadSpecs', () => {
  it.each([
    ['registry', 'ProgrammeCreated'],
    ['program', 'Awarded'],
    ['attest', 'Attested'],
    ['record', 'Credited'],
    ['policy_spend', 'Spent'],
  ] as const)('has the %s contract events from the bindings (%s)', (kind, event) => {
    expect(() => specs[kind].eventTopicFilter(event)).not.toThrow();
  });
});

describe('decodeEvent', () => {
  it('decodes a registry event, topics and data together', () => {
    const [event] = parseRaw([
      encodeEvent(specs.registry, 'ProgrammeCreated', { programme: PROGRAMME, creator: CREATOR, name: 'Clinic fund' }, { contractId: REGISTRY, ledger: 42 }),
    ]);

    expect(decodeEvent(event!, 'registry', specs)).toMatchObject({
      kind: 'registry',
      name: 'ProgrammeCreated',
      contractId: REGISTRY,
      ledger: 42,
      data: { programme: PROGRAMME, creator: CREATOR, name: 'Clinic fund' },
    });
  });

  it('decodes a programme event with a struct and an enum inside', () => {
    const award = { recipient: RECIPIENT, granted: 500n, released: 0n, tranches: 2, tranches_released: 0, payee: PAYEE, mode: { tag: 'Direct' } };
    const txHash = 'ab'.repeat(32);
    const [event] = parseRaw([
      encodeEvent(specs.program, 'Awarded', { recipient: RECIPIENT, award }, { contractId: PROGRAMME, ledger: 43, txHash }),
    ]);

    const decoded = decodeEvent(event!, 'program', specs);
    expect(decoded).toMatchObject({ kind: 'program', name: 'Awarded', contractId: PROGRAMME, ledger: 43, txHash });
    expect(decoded.data).toMatchObject({
      recipient: RECIPIENT,
      award: { granted: 500n, released: 0n, tranches: 2, tranches_released: 0, payee: PAYEE, mode: { tag: 'Direct' } },
    });
  });

  it('names an event the contract spec does not describe as undecodable', () => {
    const raw = encodeEvent(specs.program, 'Contributed', { donor: RECIPIENT, amount: 1n }, { contractId: PROGRAMME, ledger: 44 });
    const [event] = parseRaw([{ ...raw, topic: [xdr.ScVal.scvSymbol('not_milepost').toXDR('base64')] }]);

    const decoded = decodeEvent(event!, 'program', specs);
    expect(decoded.name).toBe(UNDECODABLE);
    expect(decoded.data).toEqual({});
  });
});
