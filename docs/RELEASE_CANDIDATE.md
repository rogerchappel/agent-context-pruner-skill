# Release Candidate Notes

## Candidate

Initial public build for `agent-context-pruner-skill`.

## Verification

Recorded on 2026-06-28:

- `npm test` passed, 4 tests
- `npm run check` passed syntax checks for CLI, src, and tests
- `npm run build` passed, 11 required files present
- `npm run smoke` passed and produced a markdown pruning report from `test/fixtures/transcript.md`

Recorded on 2026-07-05:

- Fixed message index propagation in the pruner classifier and added a JSON transcript regression assertion.
- `bash scripts/validate.sh` passed:
  - `npm test` passed, 4 tests
  - `npm run check` passed syntax checks for CLI, src, and tests
  - `npm run build` passed, 11 required files present
  - `npm run smoke` passed and produced a markdown pruning report from `test/fixtures/transcript.md`

Recorded on 2026-07-06:

- `npm run release:check` passed locally, including syntax checks, 6 node:test cases, build-file verification, CLI help/version/example smoke, and package smoke.
- Added a GitHub Actions release gate for pull requests and pushes to `main` on Node.js 20 and 22.

## Classification

ship.
