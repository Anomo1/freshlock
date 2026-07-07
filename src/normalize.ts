import { createHash } from "node:crypto";
import type { NormalizeMode } from "./lockfile.js";

/** JSON.stringify with recursively sorted object keys, so key order and whitespace never count as drift. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ":" + stableStringify(v));
    return "{" + entries.join(",") + "}";
  }
  return JSON.stringify(value);
}

export function detectNormalize(filePath: string): NormalizeMode {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".geojson")) return "json";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  return "bytes";
}

export function normalizeContent(content: Buffer, mode: NormalizeMode): Buffer {
  if (mode === "json") {
    return Buffer.from(stableStringify(JSON.parse(content.toString("utf8"))));
  }
  if (mode === "csv") {
    const text = content.toString("utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "");
    return Buffer.from(text);
  }
  return content;
}

export function hashContent(content: Buffer, mode: NormalizeMode): string {
  const normalized = normalizeContent(content, mode);
  return "sha256-" + createHash("sha256").update(normalized).digest("hex");
}
