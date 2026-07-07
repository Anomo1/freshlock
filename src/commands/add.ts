import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { emptyLockfile, readLockfile, writeLockfile } from "../lockfile.js";
import { detectNormalize, hashContent } from "../normalize.js";
import { fetchSource } from "../fetch.js";
import { parseMaxAge } from "../age.js";

export interface AddOptions {
  source: string;
  maxAge?: string;
}

export async function add(dir: string, file: string, options: AddOptions): Promise<number> {
  if (options.maxAge) parseMaxAge(options.maxAge); // validate early
  const lock = readLockfile(dir) ?? emptyLockfile();
  const normalize = detectNormalize(file);
  const localPath = join(dir, file);

  const upstream = await fetchSource(options.source);
  const upstreamHash = hashContent(upstream, normalize);

  if (existsSync(localPath)) {
    const localHash = hashContent(readFileSync(localPath), normalize);
    if (localHash !== upstreamHash) {
      console.log(`note: local ${file} differs from upstream right now — locking the upstream version.`);
    }
  } else {
    mkdirSync(dirname(localPath), { recursive: true });
  }
  writeFileSync(localPath, upstream);

  lock.datasets[file.replaceAll("\\", "/")] = {
    source: options.source,
    integrity: upstreamHash,
    fetchedAt: new Date().toISOString(),
    ...(options.maxAge ? { maxAge: options.maxAge } : {}),
    normalize,
  };
  writeLockfile(dir, lock);
  console.log(`Locked ${file} → ${options.source}${options.maxAge ? ` (max-age ${options.maxAge})` : ""}`);
  return 0;
}
