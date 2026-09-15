import { rpc, xdr, type contract } from '@stellar/stellar-sdk';

export interface EventMeta {
  contractId: string;
  ledger: number;
  txHash?: string;
  inSuccessfulContractCall?: boolean;
}

let eventIndex = 0;

/**
 * Builds the raw getEvents entry a contract would emit for event `name`, using
 * the contract's own spec — the inverse of `Spec.parseEvent`. Tests therefore
 * exercise the same decoding path as network data, and an event renamed or
 * reshaped in the bindings fails here instead of passing against a hand-written
 * fake.
 *
 * `values` holds every field by its name in the contract, in native form:
 * addresses as strings, i128/u64 as bigint, u32 as number, BytesN as Buffer,
 * enums as `{ tag }`.
 */
export function encodeEvent(
  spec: contract.Spec,
  name: string,
  values: Record<string, unknown>,
  meta: EventMeta,
): rpc.Api.RawEventResponse {
  const event = spec.entries
    .filter((entry) => entry.switch().value === xdr.ScSpecEntryKind.scSpecEntryEventV0().value)
    .map((entry) => entry.eventV0())
    .find((candidate) => candidate.name().toString() === name);
  if (!event) throw new Error(`the spec has no event named ${name}`);

  const topicList = xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList().value;
  const encode = (param: xdr.ScSpecEventParamV0): xdr.ScVal => {
    const field = param.name().toString();
    if (!Object.hasOwn(values, field)) throw new Error(`${name}: missing field ${field}`);
    return spec.nativeToScVal(values[field], param.type());
  };

  const params = event.params();
  const topics = [
    ...event.prefixTopics().map((topic) => xdr.ScVal.scvSymbol(topic.toString())),
    ...params.filter((param) => param.location().value === topicList).map(encode),
  ];

  const dataParams = params.filter((param) => param.location().value !== topicList);
  const format = event.dataFormat().value;
  let data: xdr.ScVal;
  if (format === xdr.ScSpecEventDataFormat.scSpecEventDataFormatSingleValue().value) {
    data = dataParams[0] ? encode(dataParams[0]) : xdr.ScVal.scvVoid();
  } else if (format === xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec().value) {
    data = xdr.ScVal.scvVec(dataParams.map(encode));
  } else {
    // Soroban maps are ordered by key.
    const entries = dataParams
      .map((param) => ({ key: param.name().toString(), val: encode(param) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    data = xdr.ScVal.scvMap(entries.map(({ key, val }) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })));
  }

  // Same shape as a real id: a TOID whose high bits are the ledger, then an
  // index. A global counter keeps ids unique and ordered across a test file.
  const index = eventIndex++;
  const toid = (BigInt(meta.ledger) << 32n) + BigInt(index);
  return {
    type: 'contract',
    ledger: meta.ledger,
    ledgerClosedAt: '2026-09-15T00:00:00Z',
    contractId: meta.contractId,
    id: `${toid.toString().padStart(19, '0')}-${String(index).padStart(10, '0')}`,
    operationIndex: 0,
    transactionIndex: 0,
    txHash: meta.txHash ?? '00'.repeat(32),
    inSuccessfulContractCall: meta.inSuccessfulContractCall ?? true,
    topic: topics.map((topic) => topic.toXDR('base64')),
    value: data.toXDR('base64'),
  };
}

/** Parses raw events exactly as the SDK parses a getEvents response. */
export function parseRaw(events: rpc.Api.RawEventResponse[]): rpc.Api.EventResponse[] {
  return rpc.parseRawEvents({
    events,
    cursor: '',
    latestLedger: 0,
    oldestLedger: 0,
    latestLedgerCloseTime: '0',
    oldestLedgerCloseTime: '0',
  }).events;
}
