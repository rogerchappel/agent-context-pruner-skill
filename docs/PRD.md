# Agent Context Pruner Skill PRD

## Goal

Provide a local-first CLI and reusable skill instructions for pruning long agent transcripts into compact continuation briefs.

## Scope

- Parse markdown, JSON arrays, and JSONL message logs
- Classify transcript entries as keep, drop, verify, or redact
- Warn on likely secrets and personal data
- Emit JSON or markdown reports suitable for handoff

## Out of Scope

- Model calls
- External account writes
- Automatic deletion or mutation of source transcripts

## Acceptance

- Fixture-backed tests cover supported formats and redaction
- Smoke command produces a markdown report from the included fixture
- Skill instructions define approval and validation boundaries
