# Changelog

## [Unreleased]

- Add release-readiness checks for package metadata, pack contents, and CI verification.
- Redact legacy OpenAI `sk-...` keys and document the provider-token families
  covered by the heuristic scanner.
All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-06-29

- Initial release-candidate package for pruning local agent transcripts into
  continuation briefs.
- Includes CLI smoke coverage, fixture-backed tests, release checks, and npm
  package dry-run verification.
- Documents local-only operation, heuristic redaction limits, and review
  expectations for generated continuation briefs.
- Adds a published example transcript so README smoke commands work from the
  npm package contents instead of relying on unpublished test fixtures.
