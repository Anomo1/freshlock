import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readLockfile, writeLockfile, LOCKFILE_NAME } from "../lockfile.js";
import { detectNormalize, hashContent } from "../normalize.js";
import { fetchSource } from "../fetch.js";
import { summarizeDiff } from "../diff.js";

/**
 * Re-fetch upstream for the given files (or all), replace local copies when
 * upstream changed, and renew the freshness contract either way.
 */
export async function update(dir: string, files: string[]): Promise<number> {
  const lock = readLockfile(dir);
  if (!lock) {
    console.error(`No ${LOCKFILE_NAME} found. Run: freshlock init`);
    return 1;
  }
  const targets = files.length > 0 ? files.map((f) => f.replaceAll("\\", "/")) : Object.keys(lock.datasets);
  let failures = 0;

  for (const file of targets) {
    const entry = lock.datasets[file];
    if (!entry) {
      console.error(`✗ ${file}: not in ${LOCKFILE_NAME}`);
      failures++;
      continue;
    }
    const normalize = entry.normalize ?? detectNormalize(file);
    try {
      const upstream = await fetchSource(entry.source);
      const upstreamHash = hashContent(upstream, normalize);
      const localPath = join(dir, file);
      const old = existsSync(localPath) ? readFileSync(localPath) : null;
      let localHash: string | null;
      let corrupt = false;
      try {
        localHash = old === null ? null : hashContent(old, normalize);
      } catch {
        // Unparseable local content (e.g. hand-edited JSON) always needs restoring.
        localHash = "";
        corrupt = true;
      }
      if (upstreamHash !== entry.integrity) {
        writeFileSync(localPath, upstream);
        console.log(`↑ ${file}: ${summarizeDiff(old ?? Buffer.alloc(0), upstream, normalize)}`);
      } else if (localHash !== upstreamHash) {
        writeFileSync(localPath, upstream);
        console.log(`✓ ${file}: restored from upstream (local copy was ${old === null ? "missing" : corrupt ? "corrupt" : "modified"})`);
      } else {
        console.log(`✓ ${file}: unchanged upstream, contract renewed`);
      }
      entry.integrity = upstreamHash;
      entry.fetchedAt = new Date().toISOString();
    } catch (err) {
      console.error(`✗ ${file}: ${err instanceof Error ? err.message : String(err)}`);
      failures++;
    }
  }

  writeLockfile(dir, lock);
  return failures > 0 ? 1 : 0;
}
