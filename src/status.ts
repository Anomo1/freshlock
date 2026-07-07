import { isStale } from "./age.js";

export type DatasetStatus = "fresh" | "drift" | "stale" | "modified" | "missing" | "fetch-error";

export interface StatusInput {
  /** Hash of the local vendored file, or null if the file is missing. */
  localHash: string | null;
  /** Hash of the freshly fetched upstream content; null = fetch failed; undefined = fetch skipped. */
  upstreamHash?: string | null;
  integrity: string;
  fetchedAt: string;
  maxAge?: string;
  now: Date;
}

/**
 * Pure status evaluation for one lockfile entry.
 * Precedence: missing > modified > fetch-error > stale > drift > fresh.
 */
export function evaluateStatus(input: StatusInput): DatasetStatus {
  if (input.localHash === null) return "missing";
  if (input.localHash !== input.integrity) return "modified";
  if (input.upstreamHash === null) return "fetch-error";
  if (input.maxAge && isStale(input.fetchedAt, input.maxAge, input.now)) return "stale";
  if (input.upstreamHash !== undefined && input.upstreamHash !== input.integrity) return "drift";
  return "fresh";
}

/** Statuses that make `freshlock check` exit non-zero. Drift is a warning unless --strict. */
export function isFailure(status: DatasetStatus, strict: boolean): boolean {
  if (status === "fresh") return false;
  if (status === "drift") return strict;
  return true;
}
