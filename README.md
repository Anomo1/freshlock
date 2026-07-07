# Freshlock

**Dependabot for the data files in your repo.**

Repos are full of vendored data snapshots: `countries.json`, timezone tables, currency codes, user-agent lists, satellite catalogs, the public suffix list. You copied the file in once, and it has been quietly going stale ever since. Nothing tells you when the world changes underneath it.

Freshlock gives every vendored data file three things a package dependency already has:

1. **Provenance** — a `data.lock` entry recording exactly which upstream URL it came from.
2. **Integrity** — a content hash, so silent local edits are caught in CI.
3. **A freshness contract** — a `maxAge`, so CI fails when the file ages past what you promised.

When upstream changes, `freshlock update` applies the new data and prints a row-level diff, so your scheduled workflow can open a Dependabot-style PR instead of a mystery blob commit.

## Quick start

```bash
npx freshlock init                 # creates data.lock, suggests files it recognizes
npx freshlock add data/countries.json \
  --source https://raw.githubusercontent.com/mledoze/countries/master/countries.json \
  --max-age 30d
npx freshlock check                # exit 1 if anything is stale, modified, or missing
npx freshlock update               # re-fetch upstream, apply changes, renew contracts
```

`check` output:

```
✓ fresh        data/countries.json  (3d old / max 30d)
≠ drift        data/satellites.json  (12d old / max 14d)
               upstream changed — run: freshlock update
✗ stale        data/currencies.csv  (91d old / max 30d)
               older than max-age 30d — run: freshlock update
```

## Statuses

| Status | Meaning | `check` exit |
|---|---|---|
| `fresh` | Local file matches lock; contract holds | 0 |
| `drift` | Upstream changed since last fetch | 0 (1 with `--strict`) |
| `stale` | File older than its `maxAge` contract | 1 |
| `modified` | Local file no longer matches the lock hash | 1 |
| `missing` | File in lock but not on disk | 1 |
| `fetch-error` | Upstream unreachable | 1 |

Drift detection normalizes before hashing (sorted JSON keys, normalized CSV line endings), so formatting noise never counts as a data change.

## GitHub Action

Fail CI when data breaks its contract:

```yaml
- uses: anomo/freshlock@v1        # mode: check (default)
```

Open a Dependabot-style PR when upstream data changes (pair with any PR action):

```yaml
name: freshlock
on:
  schedule:
    - cron: "17 6 * * 1"   # weekly
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anomo/freshlock@v1
        with:
          mode: update
      - uses: peter-evans/create-pull-request@v6
        with:
          title: "chore(data): refresh vendored datasets"
          commit-message: "chore(data): refresh vendored datasets"
          branch: freshlock/update
```

## data.lock format

```json
{
  "version": 1,
  "datasets": {
    "data/countries.json": {
      "source": "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
      "integrity": "sha256-…",
      "fetchedAt": "2026-07-08T12:00:00.000Z",
      "maxAge": "30d",
      "normalize": "json"
    }
  }
}
```

- `maxAge`: `45m`, `12h`, `30d`, `2w`. Omit it for data that only changes when upstream changes (drift-only tracking).
- `normalize`: `json` | `csv` | `bytes` — inferred from the file extension, override if needed.

## What Freshlock is not

- Not a data version-control system — use DVC if you need to version large datasets.
- Not a runtime fetcher — it manages files you deliberately vendor and review.
- Not git scraping — unlike the (dormant) Flat Data action, data only enters your repo through a verified, diffed, reviewable change, and CI enforces the age you promised.

## Development

```bash
npm install
npm test
npm run build
```

Zero runtime dependencies. MIT license.
