# Agent Context Pruner Skill

Local-first CLI and skill instructions for turning long agent transcripts into compact continuation briefs.

## Quickstart

```bash
npm install
npm run smoke
node bin/agent-context-pruner.js test/fixtures/transcript.md --format json
```

## CLI

```bash
agent-context-pruner <input-file> [--format json|markdown] [--max-items n]
```

Supported inputs:

- Markdown notes or transcripts
- JSON arrays or objects with `messages`/`items`
- JSONL logs with one message object per line

## Example

```bash
node bin/agent-context-pruner.js test/fixtures/transcript.md --format markdown --max-items 8
```

The report includes counts, per-message classifications, redaction findings, and a continuation prompt guardrail.

## Safety Notes

- The tool is local-only and reads a file into memory.
- It writes reports to stdout and never edits the source transcript.
- Redaction detection is heuristic. Review `redact` and `verify` items manually before continuing a live agent.
- Do not use the generated brief as approval for connector writes or external account actions.

## Limitations

- No model summarization is used.
- Very large transcripts should be chunked before running the MVP.
- Secret detection favors common token shapes and may miss domain-specific credentials.

## Development

```bash
npm test
npm run check
npm run build
npm run smoke
npm run package:smoke
npm run release:check
```

## Release Readiness

Before publishing, run `npm run release:check` and review the dry-run package
contents printed by `npm run package:smoke`. The package should include the CLI,
library modules, skill instructions, fixtures, release notes, and security
policy.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and vulnerability
reporting guidance. Keep real transcripts, secrets, and customer data out of
public issues and fixtures.
