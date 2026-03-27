# Definition of Done

A feature or release of `changelog-collect-action` is considered **done** when all of the following
checkboxes are ticked.

## Code Quality

- [ ] All TypeScript source files compile without errors (`npm run lint`)
- [ ] No usage of `as any`, `@ts-ignore`, or `@ts-expect-error`
- [ ] No empty `catch` blocks
- [ ] No hardcoded credentials, tokens, or secrets
- [ ] No TODO/FIXME comments in production code (`src/`)
- [ ] All public functions and classes have JSDoc `@param` / `@returns` comments where non-obvious

## Testing

- [ ] All tests pass: `npm test` exits with code 0
- [ ] New logic is covered by at least one unit test
- [ ] Edge cases (empty arrays, byte truncation, exclusion filter) have dedicated tests
- [ ] Test coverage is ≥ 80% on statements (enforced by `vitest --coverage`)

## Build & Artefacts

- [ ] `npm run build` exits with code 0
- [ ] `dist/index.js` exists and is the bundled artefact from the latest `src/` code
- [ ] `dist/` is committed to the repository (required by the GitHub Actions runner)
- [ ] `node_modules/` is **not** committed (`.gitignore` covers it)

## Documentation

- [ ] `README.md` contains inputs/outputs table, usage example, and schema docs
- [ ] `ACCEPTANCE_CRITERIA.md` is up to date
- [ ] `action.yml` describes all inputs and outputs correctly

## Repository

- [ ] `action.yml` is present at the repository root
- [ ] `.github/workflows/ci.yml` runs `npm test` and `npm run build` on every push/PR to `main`
- [ ] `LICENSE` (GPL-3.0) is present at the repository root
- [ ] `.gitignore` excludes `node_modules/`, `coverage/`, `lib/`, and `*.js.map`

## Release

- [ ] Git tag `vX.Y.Z` is created for the release commit
- [ ] GitHub Release is published with release notes
- [ ] The release commit includes the built `dist/index.js`
- [ ] Pipeline compatibility is confirmed: `changeset.v1.json` is accepted by `changelog-analyze-action`
