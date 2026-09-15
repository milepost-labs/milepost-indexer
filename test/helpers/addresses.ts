import { StrKey } from '@stellar/stellar-sdk';

/** A valid, deterministic contract address (C…) for tests. */
export function contractAddress(n: number): string {
  return StrKey.encodeContract(Buffer.alloc(32, n));
}

/** A valid, deterministic account address (G…) for tests. */
export function accountAddress(n: number): string {
  return StrKey.encodeEd25519PublicKey(Buffer.alloc(32, n));
}
