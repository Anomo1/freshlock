import { stableStringify } from "./normalize.js";
import type { NormalizeMode } from "./lockfile.js";

const KEY_CANDIDATES = ["id", "code", "key", "name", "alpha2", "cca2"];

function pickKey(rows: Record<string, unknown>[]): string | null {
  for (const key of KEY_CANDIDATES) {
    const values = rows.map((r) => r[key]).filter((v) => v !== undefined);
    if (values.length === rows.length && new Set(values.map(String)).size === rows.length) {
      return key;
    }
  }
  return null;
}

function diffKeyedRows(
  oldRows: Record<string, unknown>[],
  newRows: Record<string, unknown>[],
  key: string,
): string {
  const oldMap = new Map(oldRows.map((r) => [String(r[key]), r]));
  const newMap = new Map(newRows.map((r) => [String(r[key]), r]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const k of newMap.keys()) if (!oldMap.has(k)) added++;
  for (const [k, oldRow] of oldMap) {
    const newRow = newMap.get(k);
    if (newRow === undefined) removed++;
    else if (stableStringify(oldRow) !== stableStringify(newRow)) changed++;
  }
  return `+${added} rows, -${removed} rows, ~${changed} changed (keyed by "${key}")`;
}

function diffLines(oldText: string, newText: string): string {
  const oldLines = new Set(oldText.split(/\r?\n/));
  const newLines = new Set(newText.split(/\r?\n/));
  let added = 0;
  let removed = 0;
  for (const l of newLines) if (!oldLines.has(l)) added++;
  for (const l of oldLines) if (!newLines.has(l)) removed++;
  return `+${added} lines, -${removed} lines`;
}

/** Human-readable one-line summary of what changed between two versions of a data file. */
export function summarizeDiff(oldContent: Buffer, newContent: Buffer, mode: NormalizeMode): string {
  try {
    if (mode === "json") {
      const oldVal = JSON.parse(oldContent.toString("utf8")) as unknown;
      const newVal = JSON.parse(newContent.toString("utf8")) as unknown;
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        const oldRows = oldVal.filter((r) => r !== null && typeof r === "object") as Record<string, unknown>[];
        const newRows = newVal.filter((r) => r !== null && typeof r === "object") as Record<string, unknown>[];
        if (oldRows.length === oldVal.length && newRows.length === newVal.length) {
          const key = pickKey(oldRows) ?? pickKey(newRows);
          if (key) return diffKeyedRows(oldRows, newRows, key);
        }
        return `${oldVal.length} → ${newVal.length} items`;
      }
      return "content changed";
    }
    if (mode === "csv") {
      return diffLines(oldContent.toString("utf8"), newContent.toString("utf8"));
    }
  } catch {
    // fall through to byte summary
  }
  return `content changed (${oldContent.length} → ${newContent.length} bytes)`;
}
