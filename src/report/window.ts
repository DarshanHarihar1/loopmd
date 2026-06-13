// Parse a --since window (e.g. "24h", "7d") into a millisecond duration, and
// compute the cutoff timestamp records must be at or after to be included.

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export const DEFAULT_SINCE = "24h";

// Returns the window length in milliseconds, or null if the spec is malformed.
export function parseSince(spec: string): number | null {
  const m = /^(\d+)([smhdw])$/.exec(spec.trim());
  if (!m) return null;
  return Number(m[1]) * UNIT_MS[m[2]!]!;
}

// Records with startedAt >= cutoff are inside the window.
export function cutoff(now: Date, windowMs: number): Date {
  return new Date(now.getTime() - windowMs);
}
