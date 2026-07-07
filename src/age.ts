const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Parse a max-age string like "30d", "12h", "45m", "2w" into milliseconds. */
export function parseMaxAge(maxAge: string): number {
  const match = /^(\d+)([mhdw])$/.exec(maxAge.trim());
  if (!match) {
    throw new Error(`invalid max-age "${maxAge}" (expected e.g. 30d, 12h, 45m, 2w)`);
  }
  return Number(match[1]) * UNIT_MS[match[2]!]!;
}

export function isStale(fetchedAt: string, maxAge: string, now: Date): boolean {
  const fetched = Date.parse(fetchedAt);
  if (Number.isNaN(fetched)) throw new Error(`invalid fetchedAt "${fetchedAt}"`);
  return now.getTime() - fetched > parseMaxAge(maxAge);
}

export function ageInDays(fetchedAt: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(fetchedAt)) / UNIT_MS.d!);
}
