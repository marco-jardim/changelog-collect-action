# changelog-collect-action

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![CI](https://github.com/marco-jardim/changelog-collect-action/actions/workflows/ci.yml/badge.svg)](https://github.com/marco-jardim/changelog-collect-action/actions/workflows/ci.yml)

> **Step 1 of 4** in the modular changelog pipeline.

Collects the full commit-range diff between two SHAs on GitHub and writes a structured `changeset.v1.json` document to the workspace. This file is consumed by the next step in the pipeline — [`changelog-analyze-action`](https://github.com/marco-jardim/changelog-analyze-action).

```
changelog-collect-action  →  changelog-analyze-action  →  changelog-format-action  →  changelog-publish-action
      (step 1/4)                    (step 2/4)                   (step 3/4)                  (step 4/4)
```

---

## Inputs

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `github_token` | ✅ | — | GitHub token for API access (`${{ secrets.GITHUB_TOKEN }}` works for most repos) |
| `from_sha` | ✅ | — | Base commit SHA — start of the diff range |
| `to_sha` | ✅ | — | Head commit SHA — end of the diff range |
| `repo` | ❌ | `${{ github.repository }}` | Repository in `owner/name` format |
| `exclude_patterns` | ❌ | `package-lock.json,yarn.lock,pnpm-lock.yaml,*.lock,*.min.js,*.min.css,dist/**,build/**,*.generated.*` | Comma-separated glob patterns for files to exclude from the changeset |
| `max_diff_bytes` | ❌ | `500000` | Maximum total patch bytes. When exceeded, patch content is truncated to an empty string and `truncated: true` is set on the commit's diff summary |

## Outputs

| Name | Description |
|------|-------------|
| `changeset_path` | Absolute path to the generated `changeset.v1.json` |
| `commit_count` | Number of commits in the range |
| `file_count` | Number of unique files changed (after exclusion) |

---

## Usage

### Minimal

```yaml
- name: Collect changelog
  uses: marco-jardim/changelog-collect-action@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    from_sha: ${{ github.event.before }}
    to_sha: ${{ github.sha }}
```

### Full workflow example

```yaml
name: Changelog Pipeline

on:
  push:
    branches: [main]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Step 1 — collect raw diff data
      - name: Collect changelog
        id: collect
        uses: marco-jardim/changelog-collect-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          from_sha: ${{ github.event.before }}
          to_sha: ${{ github.sha }}
          exclude_patterns: >-
            package-lock.json,yarn.lock,pnpm-lock.yaml,
            *.lock,*.min.js,*.min.css,
            dist/**,build/**,*.generated.*
          max_diff_bytes: '500000'

      - name: Show outputs
        run: |
          echo "Changeset at: ${{ steps.collect.outputs.changeset_path }}"
          echo "Commits: ${{ steps.collect.outputs.commit_count }}"
          echo "Files: ${{ steps.collect.outputs.file_count }}"

      # Step 2 — analyze (next action in the pipeline)
      # - uses: marco-jardim/changelog-analyze-action@v1
      #   with:
      #     changeset_path: ${{ steps.collect.outputs.changeset_path }}
```

---

## `changeset.v1.json` Schema

The action writes a single JSON file conforming to the following schema. It is designed to be deterministic for a given `from_sha`/`to_sha` pair (see `idempotency_key`).

```jsonc
{
  // Always "1" — bump when breaking changes are introduced
  "schema_version": "1",

  // Stable key for deduplication: "owner/repo:from_sha:to_sha"
  "idempotency_key": "marco-jardim/my-app:abc1234:def5678",

  "repo": "marco-jardim/my-app",
  "from_sha": "abc1234def5678901234567890123456789012345",
  "to_sha":   "def5678abc1234901234567890123456789012345",

  // GitHub compare URL for this range
  "compare_url": "https://github.com/marco-jardim/my-app/compare/abc1234...def5678",

  // ISO-8601 timestamp when the action ran
  "generated_at": "2024-01-15T10:00:00.000Z",

  "commits": [
    {
      "sha": "def5678abc1234901234567890123456789012345",
      "short_sha": "def5678",              // always 7 chars
      "message": "feat: add user profile page",
      "author": "Alice Dev",
      "author_email": "alice@example.com",
      "timestamp": "2024-01-15T09:45:00Z",
      "url": "https://github.com/marco-jardim/my-app/commit/def5678",
      "diff_summary": {
        "files_changed": 2,
        "additions": 85,
        "deletions": 12,
        "truncated": false,               // true when patch was clipped by max_diff_bytes
        "hunks": [
          {
            "filename": "src/routes/profile.ts",
            "additions": 72,
            "deletions": 8,
            "patch": "@@ -1,5 +1,10 @@\n+import { UserProfile }..."
          },
          {
            "filename": "src/components/Avatar.tsx",
            "additions": 13,
            "deletions": 4,
            "patch": "@@ -3,7 +3,12 @@\n+export function Avatar..."
          }
        ]
      }
    }
  ],

  // Aggregated over the full range (unique files, not per-commit sum)
  "totals": {
    "commit_count": 1,
    "files_changed": 2,   // unique file count across all commits
    "additions": 85,
    "deletions": 12
  }
}
```

---

## Exclude Patterns Guide

Patterns support three wildcards:

| Wildcard | Matches |
|----------|---------|
| `*` | Any sequence of characters **except** `/` |
| `**` | Any sequence of characters **including** `/` (cross-directory) |
| `?` | Exactly one character **except** `/` |

### Examples

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `package-lock.json` | `package-lock.json` | `sub/package-lock.json` |
| `*.lock` | `yarn.lock`, `Pipfile.lock` | `sub/foo.lock` |
| `dist/**` | `dist/bundle.js`, `dist/assets/app.css` | `src/dist-copy.js` |
| `*.generated.*` | `schema.generated.ts` | `src/schema.generated.ts` |
| `src/**/*.test.ts` | `src/utils/foo.test.ts` | `tests/foo.test.ts` |

---

## Development

```bash
git clone https://github.com/marco-jardim/changelog-collect-action
cd changelog-collect-action
npm install
npm test        # run jest test suite
npm run lint    # type-check with tsc --noEmit
npm run build   # bundle to dist/index.js via @vercel/ncc
```

### Project structure

```
src/
  types.ts       — TypeScript interfaces (ChangesetV1, CommitEntry, …)
  filter.ts      — shouldExcludeFile() glob-based file filter
  collector.ts   — ChangesetCollector class (GitHub API + assembly logic)
  index.ts       — Action entrypoint (reads inputs, writes JSON, sets outputs)
tests/
  filter.test.ts    — 17 tests for the glob filter
  collector.test.ts — 8 tests for the collector (Octokit mocked)
  schema.test.ts    — 8 tests for ChangesetV1 schema validation
dist/
  index.js       — bundled action (committed, used by action runner)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-improvement`
3. Make your changes and add tests
4. Run `npm test && npm run build`
5. Commit the updated `dist/index.js` alongside your source changes
6. Open a pull request

Please follow the existing code style (no `as any`, strict TypeScript, custom errors).

---

## License

GNU General Public License v3.0 — see [LICENSE](./LICENSE) for full text.
