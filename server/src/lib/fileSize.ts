/** Convert Drive / upload sizes to Prisma BigInt (files can exceed INT4 ~2GB). */
export function toDbFileSize(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  try {
    if (typeof value === 'bigint') return value >= 0n ? value : null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return null;
      return BigInt(Math.trunc(value));
    }
    const n = BigInt(String(value).trim());
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}
