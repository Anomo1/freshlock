import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stableStringify, hashContent, detectNormalize } from "../src/normalize.js";
import { parseMaxAge, isStale } from "../src/age.js";
import { evaluateStatus, isFailure } from "../src/status.js";
import { summarizeDiff } from "../src/diff.js";
import { emptyLockfile, readLockfile, writeLockfile } from "../src/lockfile.js";

describe("normalize", () => {
  it("stableStringify sorts keys recursively", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("json hash ignores key order and whitespace", () => {
    const a = Buffer.from('{ "x": 1,\n  "y": [1, 2] }');
    const b = Buffer.from('{"y":[1,2],"x":1}');
    expect(hashContent(a, "json")).toBe(hashContent(b, "json"));
  });

  it("json hash detects real value changes", () => {
    expect(hashContent(Buffer.from('{"x":1}'), "json")).not.toBe(hashContent(Buffer.from('{"x":2}'), "json"));
  });

  it("csv hash ignores CRLF and trailing newlines", () => {
    const a = Buffer.from("a,b\r\n1,2\r\n");
    const b = Buffer.from("a,b\n1,2");
    expect(hashContent(a, "csv")).toBe(hashContent(b, "csv"));
  });

  it("detects normalize mode from extension", () => {
    expect(detectNormalize("data/countries.json")).toBe("json");
    expect(detectNormalize("data/rows.CSV")).toBe("csv");
    expect(detectNormalize("data/list.dat")).toBe("bytes");
  });
});

describe("age", () => {
  it("parses units", () => {
    expect(parseMaxAge("30d")).toBe(30 * 86_400_000);
    expect(parseMaxAge("12h")).toBe(12 * 3_600_000);
    expect(parseMaxAge("2w")).toBe(2 * 604_800_000);
  });

  it("rejects garbage", () => {
    expect(() => parseMaxAge("30 days")).toThrow();
    expect(() => parseMaxAge("d30")).toThrow();
  });

  it("staleness is exclusive of the boundary", () => {
    const fetched = "2026-06-01T00:00:00.000Z";
    expect(isStale(fetched, "30d", new Date("2026-07-01T00:00:00.000Z"))).toBe(false);
    expect(isStale(fetched, "30d", new Date("2026-07-01T00:00:01.000Z"))).toBe(true);
  });
});

describe("status", () => {
  const base = {
    integrity: "sha256-aaa",
    fetchedAt: "2026-07-01T00:00:00.000Z",
    now: new Date("2026-07-08T00:00:00.000Z"),
  };

  it("fresh when everything matches", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-aaa", upstreamHash: "sha256-aaa", maxAge: "30d" })).toBe("fresh");
  });

  it("missing beats everything", () => {
    expect(evaluateStatus({ ...base, localHash: null, upstreamHash: "sha256-bbb" })).toBe("missing");
  });

  it("modified when local file drifted from lock", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-zzz", upstreamHash: "sha256-aaa" })).toBe("modified");
  });

  it("stale beats drift", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-aaa", upstreamHash: "sha256-bbb", maxAge: "1d" })).toBe("stale");
  });

  it("drift when upstream changed within contract", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-aaa", upstreamHash: "sha256-bbb", maxAge: "30d" })).toBe("drift");
  });

  it("fresh offline when fetch skipped and not stale", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-aaa", maxAge: "30d" })).toBe("fresh");
  });

  it("fetch-error when upstream unreachable", () => {
    expect(evaluateStatus({ ...base, localHash: "sha256-aaa", upstreamHash: null })).toBe("fetch-error");
  });

  it("drift fails only in strict mode", () => {
    expect(isFailure("drift", false)).toBe(false);
    expect(isFailure("drift", true)).toBe(true);
    expect(isFailure("stale", false)).toBe(true);
    expect(isFailure("fresh", true)).toBe(false);
  });
});

describe("diff", () => {
  it("keyed row diff for JSON arrays", () => {
    const oldRows = Buffer.from(JSON.stringify([{ id: 1, v: "a" }, { id: 2, v: "b" }]));
    const newRows = Buffer.from(JSON.stringify([{ id: 1, v: "a" }, { id: 2, v: "B" }, { id: 3, v: "c" }]));
    expect(summarizeDiff(oldRows, newRows, "json")).toBe('+1 rows, -0 rows, ~1 changed (keyed by "id")');
  });

  it("line diff for CSV", () => {
    const a = Buffer.from("h\n1\n2");
    const b = Buffer.from("h\n1\n3");
    expect(summarizeDiff(a, b, "csv")).toBe("+1 lines, -1 lines");
  });

  it("byte fallback for invalid JSON", () => {
    expect(summarizeDiff(Buffer.from("not json"), Buffer.from("also not"), "json")).toMatch(/bytes\)$/);
  });
});

describe("lockfile", () => {
  it("round-trips and sorts dataset keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "freshlock-"));
    const lock = emptyLockfile();
    lock.datasets["z/b.json"] = { source: "https://x", integrity: "sha256-1", fetchedAt: "2026-07-08T00:00:00.000Z" };
    lock.datasets["a/a.json"] = { source: "https://y", integrity: "sha256-2", fetchedAt: "2026-07-08T00:00:00.000Z", maxAge: "30d" };
    writeLockfile(dir, lock);
    const back = readLockfile(dir);
    expect(back).not.toBeNull();
    expect(Object.keys(back!.datasets)).toEqual(["a/a.json", "z/b.json"]);
    expect(back!.datasets["a/a.json"]!.maxAge).toBe("30d");
  });

  it("returns null when absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "freshlock-"));
    expect(readLockfile(dir)).toBeNull();
  });
});
