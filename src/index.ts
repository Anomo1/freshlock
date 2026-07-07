export { readLockfile, writeLockfile, emptyLockfile, LOCKFILE_NAME } from "./lockfile.js";
export type { Lockfile, DatasetEntry, NormalizeMode } from "./lockfile.js";
export { stableStringify, normalizeContent, hashContent, detectNormalize } from "./normalize.js";
export { parseMaxAge, isStale, ageInDays } from "./age.js";
export { evaluateStatus, isFailure } from "./status.js";
export type { DatasetStatus, StatusInput } from "./status.js";
export { summarizeDiff } from "./diff.js";
