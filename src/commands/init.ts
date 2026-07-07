import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { emptyLockfile, readLockfile, writeLockfile, LOCKFILE_NAME } from "../lockfile.js";
import { suggestSource } from "../registry.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "vendor", "coverage"]);
const SKIP_FILES = new Set(["package.json", "package-lock.json", "tsconfig.json", "data.lock"]);
const DATA_EXTENSIONS = [".json", ".csv", ".tsv", ".dat", ".geojson"];

function findDataFiles(root: string, dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith(".")) findDataFiles(root, full, out);
    } else if (
      DATA_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)) &&
      !SKIP_FILES.has(name) &&
      !name.endsWith(".config.json")
    ) {
      out.push(relative(root, full).replaceAll("\\", "/"));
    }
  }
}

export function init(dir: string): number {
  if (readLockfile(dir)) {
    console.log(`${LOCKFILE_NAME} already exists.`);
  } else {
    writeLockfile(dir, emptyLockfile());
    console.log(`Created ${LOCKFILE_NAME}.`);
  }

  const files: string[] = [];
  findDataFiles(dir, dir, files);
  if (files.length === 0) {
    console.log("No data files found to suggest. Add one with:");
    console.log("  freshlock add <file> --source <url> [--max-age 30d]");
    return 0;
  }

  console.log("\nData files found. To lock one to its upstream source:");
  for (const file of files.slice(0, 25)) {
    const known = suggestSource(file);
    if (known) {
      console.log(`  freshlock add ${file} --source ${known.source}   # ${known.note} (guessed — verify!)`);
    } else {
      console.log(`  freshlock add ${file} --source <url>`);
    }
  }
  if (files.length > 25) console.log(`  … and ${files.length - 25} more`);
  return 0;
}
