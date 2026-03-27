# Acceptance Criteria

## Functional Requirements

### Inputs & Configuration
- [ ] `github_token` input is required and used for all GitHub API calls
- [ ] `from_sha` input is required and represents the base of the diff range
- [ ] `to_sha` input is required and represents the head of the diff range
- [ ] `repo` input defaults to `${{ github.repository }}` when not provided
- [ ] `exclude_patterns` input accepts comma-separated glob patterns
- [ ] `max_diff_bytes` input limits total patch bytes written to the changeset

### Changeset Output
- [ ] Action writes a valid `changeset.v1.json` file to the workspace
- [ ] `schema_version` is always the string `"1"`
- [ ] `idempotency_key` follows the format `owner/repo:from_sha:to_sha`
- [ ] `repo` field contains the `owner/name` string
- [ ] `from_sha` and `to_sha` match the inputs exactly
- [ ] `compare_url` is the GitHub HTML compare URL for the range
- [ ] `generated_at` is an ISO-8601 timestamp
- [ ] `commits` is an array of `CommitEntry` objects (may be empty)
- [ ] `totals` contains `commit_count`, `files_changed`, `additions`, `deletions`

### Commit Entries
- [ ] Each commit entry contains `sha`, `short_sha`, `message`, `author`, `author_email`, `timestamp`, `url`, `diff_summary`
- [ ] `short_sha` is exactly 7 characters (first 7 of the full SHA)
- [ ] `diff_summary.files_changed` reflects only non-excluded files
- [ ] `diff_summary.hunks` contains per-file additions, deletions, and patch
- [ ] `diff_summary.truncated` is set to `true` when the byte budget is exceeded

### File Filtering
- [ ] Files matching any `exclude_patterns` pattern are omitted from the changeset
- [ ] `*` wildcard matches any characters except `/`
- [ ] `**` wildcard matches any characters including `/`
- [ ] `?` wildcard matches exactly one character except `/`
- [ ] Exact filename patterns (e.g. `package-lock.json`) work correctly
- [ ] Directory wildcard patterns (e.g. `dist/**`) work correctly
- [ ] Extension patterns (e.g. `*.min.js`) work correctly

### Totals
- [ ] `totals.files_changed` counts **unique** files across all commits (not per-commit sum)
- [ ] `totals.additions` and `totals.deletions` are summed across all commits (post-filter)
- [ ] `totals.commit_count` equals the number of commits in the range

### Action Outputs
- [ ] `changeset_path` output is the absolute path to `changeset.v1.json`
- [ ] `commit_count` output matches `totals.commit_count`
- [ ] `file_count` output matches `totals.files_changed`

### Error Handling
- [ ] Invalid `repo` format causes `core.setFailed()` with a descriptive message
- [ ] GitHub API errors are caught and propagate via `core.setFailed()`
- [ ] Invalid `max_diff_bytes` value causes `core.setFailed()`

## Non-Functional Requirements

- [ ] No hardcoded tokens or secrets
- [ ] No TypeScript `as any`, `@ts-ignore`, or `@ts-expect-error`
- [ ] `node_modules/` is not committed
- [ ] `dist/index.js` is committed and up to date
- [ ] All tests pass: `npm test` exits 0
- [ ] Type check passes: `npm run lint` exits 0
- [ ] Build succeeds: `npm run build` exits 0
- [ ] CI workflow runs on push and pull_request to `main`

## Test Coverage

- [ ] `filter.test.ts` — ≥ 8 tests covering all glob wildcard types
- [ ] `collector.test.ts` — ≥ 8 tests with mocked Octokit
- [ ] `schema.test.ts` — ≥ 4 tests for ChangesetV1 validation
- [ ] Test coverage report generated in `coverage/`
