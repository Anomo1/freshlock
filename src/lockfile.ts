import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type NormalizeMode = "json" | "csv" | "bytes";

export interface DatasetEntry {
  /** Upstream URL the file was vendored from. */
  source: string;
  /** Hash of the normalized vendored content, e.g. "sha256-abc123…". */
  integrity: string;
  /** ISO timestamp of the last time upstream was fetched and verified. */
  fetchedAt: string;
  /** Freshness contract, e.g. "30d", "12h". Absent = never goes stale. */
  maxAge?: string;
  /** How content is normalized before hashing. Default inferred from extension. */
  normalize?: NormalizeMode;
}

export interface Lockfile {
  version: 1;
  datasets: Record<string, DatasetEntry>;
}

export const LOCKFILE_NAME = "data.lock";

export function emptyLockfile(): Lockfile {
  return { version: 1, datasets: {} };
}

export function lockfilePath(dir: string): string {
  return join(dir, LOCKFILE_NAME);
}

export function readLockfile(dir: string): Lockfile | null {
  const path = lockfilePath(dir);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Lockfile;
  if (parsed.version !== 1 || typeof parsed.datasets !== "object") {
    throw new Error(`${LOCKFILE_NAME}: unsupported format`);
  }
  return parsed;
}

export function writeLockfile(dir: string, lock: Lockfile): void {
  const sorted: Lockfile = {
    version: lock.version,
    datasets: Object.fromEntries(
      Object.entries(lock.datasets).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  writeFileSync(lockfilePath(dir), JSON.stringify(sorted, null, 2) + "\n");
}
