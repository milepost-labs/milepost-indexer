import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Writes `value` as formatted JSON, replacing the file only once it is fully
 * written. A bigint is refused rather than coerced: amounts are stored as
 * decimal strings, and a bigint reaching here means a handler forgot to.
 */
export async function writeJson(file: string, value: unknown): Promise<void> {
  const text = JSON.stringify(
    value,
    (key, field: unknown) => {
      if (typeof field === 'bigint') throw new TypeError(`${file}: "${key}" is a bigint; store it as a string`);
      return field;
    },
    2,
  );
  await mkdir(path.dirname(file), { recursive: true });
  const partial = `${file}.partial`;
  await writeFile(partial, `${text}\n`);
  await rename(partial, file);
}
