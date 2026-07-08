import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readLockfile, LOCKFILE_NAME } from "../lockfile.js";
import { detectNormalize, hashContent } from "../normalize.js";
import { fetchSource } from "../fetch.js";
import { evaluateStatus, isFailure, type DatasetStatus } from "../status.js";
import { ageInDays } from "../age.js";

export interface CheckOptions {
  strict: boolean;
  json: boolean;
  /** Skip network fetches; only verify local integrity and staleness. */
  offline: boolean;
}

export interface CheckResult {
  file: string;
  status: DatasetStatus;
  ageDays: number;
  maxAge?: string;
  detail?: string;
}

const STATUS_LABEL: Record<DatasetStatus, string> = {
  fresh: "✓ fresh",
  drift: "≠ drift",
  stale: "✗ stale",
  modified: "✗ modified",
  missing: "✗ missing",
  "fetch-error": "✗ fetch-error",
};

export async function check(dir: string, options: CheckOptions): Promise<number> {
  const lock = readLockfile(dir);
  if (!lock) {
    console.error(`No ${LOCKFILE_NAME} found. Run: freshlock init`);
    return 1;
  }

  const now = new Date();
  const results: CheckResult[] = [];

  for (const [file, entry] of Object.entries(lock.datasets)) {
    const normalize = entry.normalize ?? detectNormalize(file);
    const localPath = join(dir, file);

    let localHash: string | null = null;
    let corruptError: string | undefined;
    if (existsSync(localPath)) {
      try {
        localHash = hashContent(readFileSync(localPath), normalize);
      } catch (err) {
        // Unparseable content (e.g. hand-edited JSON) never matches the lock — treat as modified.
        localHash = "";
        corruptError = err instanceof Error ? err.message : String(err);
      }
    }

    let upstreamHash: string | null | undefined = undefined;
    let detail: string | undefined;
    if (!options.offline && localHash !== null && !corruptError) {
      try {
        upstreamHash = hashContent(await fetchSource(entry.source), normalize);
      } catch (err) {
        upstreamHash = null;
        detail = err instanceof Error ? err.message : String(err);
      }
    }

    const status = evaluateStatus({
      localHash,
      upstreamHash,
      integrity: entry.integrity,
      fetchedAt: entry.fetchedAt,
      maxAge: entry.maxAge,
      now,
    });
    if (status === "drift") detail = "upstream changed — run: freshlock update";
    if (status === "stale") detail = `older than max-age ${entry.maxAge} — run: freshlock update`;
    if (status === "modified") {
      detail = corruptError
        ? `not valid ${normalize}: ${corruptError} — run: freshlock update`
        : "local file no longer matches data.lock integrity";
    }

    results.push({ file, status, ageDays: ageInDays(entry.fetchedAt, now), maxAge: entry.maxAge, detail });
  }

  const failures = results.filter((r) => isFailure(r.status, options.strict));

  if (options.json) {
    console.log(JSON.stringify({ ok: failures.length === 0, results }, null, 2));
  } else {
    for (const r of results) {
      const age = `${r.ageDays}d old${r.maxAge ? ` / max ${r.maxAge}` : ""}`;
      console.log(`${STATUS_LABEL[r.status].padEnd(14)} ${r.file}  (${age})${r.detail ? `\n               ${r.detail}` : ""}`);
    }
    const drifted = results.filter((r) => r.status === "drift").length;
    console.log(
      `\n${results.length} dataset(s): ${results.length - failures.length - (options.strict ? 0 : drifted)} fresh, ${drifted} drifted, ${failures.length} failing`,
    );
  }
  return failures.length > 0 ? 1 : 0;
}
