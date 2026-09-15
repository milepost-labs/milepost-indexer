/**
 * Narrowing for decoded event fields. The contract spec has already decoded
 * each field into its shape, so a mismatch here is a bug in a handler, not bad
 * input, and it stops the run rather than publishing a guess.
 */

export function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`${field}: expected a string, got ${typeof value}`);
  return value;
}

export function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number') throw new TypeError(`${field}: expected a number, got ${typeof value}`);
  return value;
}

export function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${field}: expected a boolean, got ${typeof value}`);
  return value;
}

/** A BytesN field, such as an attestation uid, as lowercase hex. */
export function asHex(value: unknown, field: string): string {
  if (!Buffer.isBuffer(value)) throw new TypeError(`${field}: expected bytes, got ${typeof value}`);
  return value.toString('hex');
}

/** An i128 or u64 amount, as the decimal string published JSON carries. */
export function asAmount(value: unknown, field: string): string {
  if (typeof value !== 'bigint') throw new TypeError(`${field}: expected a bigint, got ${typeof value}`);
  return value.toString();
}

export function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${field}: expected an object`);
  }
  return value as Record<string, unknown>;
}

/** The variant name of a contract enum, e.g. `Direct` for `Mode::Direct`. */
export function asTag(value: unknown, field: string): string {
  return asString(asRecord(value, field).tag, `${field}.tag`);
}
