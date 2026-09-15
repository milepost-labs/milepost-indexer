import type { Handler } from '../reduce.ts';
import { asAmount, asNumber, asRecord, asString, asTag } from './values.ts';

/**
 * `Awarded` and `Released` both carry the award as it stands after the call,
 * so either one replaces the whole record. `ReleasedBatch` carries no award
 * and is not handled yet, so amounts can trail a batch release until the next
 * `Released`; readers take current amounts from `get_award`.
 */
const upsertAward: Handler = (state, event) => {
  const award = asRecord(event.data.award, 'award');
  const recipient = asString(award.recipient, 'award.recipient');
  const programme = (state.awards[event.contractId] ??= {});
  programme[recipient] = {
    recipient,
    granted: asAmount(award.granted, 'award.granted'),
    released: asAmount(award.released, 'award.released'),
    tranches: asNumber(award.tranches, 'award.tranches'),
    tranchesReleased: asNumber(award.tranches_released, 'award.tranches_released'),
    payee: asString(award.payee, 'award.payee'),
    mode: asTag(award.mode, 'award.mode'),
    updatedLedger: event.ledger,
  };
};

export const awardHandlers: Record<string, Handler> = {
  'program:Awarded': upsertAward,
  'program:Released': upsertAward,
};
