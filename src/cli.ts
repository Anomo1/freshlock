#!/usr/bin/env node
import { init } from "./commands/init.js";
import { add } from "./commands/add.js";
import { check } from "./commands/check.js";
import { update } from "./commands/update.js";

const HELP = `freshlock — Dependabot for the data files in your repo

Usage:
  freshlock init                                Create data.lock and suggest files to lock
  freshlock add <file> --source <url> [--max-age 30d]
                                                Vendor <file> from <url> and lock it
  freshlock check [--strict] [--json] [--offline]
                                                Verify integrity, staleness, and upstream drift
                                                (exit 1 on stale/modified/missing; --strict also fails on drift)
  freshlock update [file...]                    Re-fetch upstream, apply changes, renew contracts

data.lock entry: { source, integrity, fetchedAt, maxAge?, normalize? }
`;

function flag(args: string[], name: string): boolean {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value`);
  args.splice(i, 2);
  return value;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.shift();
  const cwd = process.cwd();

  switch (command) {
    case "init":
      return init(cwd);
    case "add": {
      const source = option(args, "--source");
      const maxAge = option(args, "--max-age");
      const file = args[0];
      if (!file || !source) {
        console.error("usage: freshlock add <file> --source <url> [--max-age 30d]");
        return 1;
      }
      return add(cwd, file, { source, maxAge });
    }
    case "check":
      return check(cwd, {
        strict: flag(args, "--strict"),
        json: flag(args, "--json"),
        offline: flag(args, "--offline"),
      });
    case "update":
      return update(cwd, args.filter((a) => !a.startsWith("--")));
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return 0;
    default:
      console.error(`unknown command "${command}"\n\n${HELP}`);
      return 1;
  }
}

// Set exitCode instead of process.exit(): hard-exiting while undici keepalive
// sockets are draining triggers a libuv assertion crash on Windows.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
