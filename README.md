# Agent Context Pruner Skill

Local-first CLI and skill instructions for turning long agent transcripts into compact continuation briefs.

## Quickstart

```bash
npm install
npm run smoke
node bin/agent-context-pruner.js --help
node bin/agent-context-pruner.js examples/transcript.md --format json
```

## CLI

```bash
agent-context-pruner <input-file> [--format json|markdown] [--max-items n]
```

Supported inputs:

- Markdown notes or transcripts
- JSON arrays of message objects
- JSON objects with a `messages` or `items` array of message objects
- JSONL logs with one message object per line

Each JSON message must be an object. Scalar rows such as strings, numbers, or
`null` are rejected with the row number so malformed exports can be corrected
without silently losing content.

`--format` and `--max-items` each require an explicit value and may be supplied
only once. Unknown options are rejected rather than treated as input filenames.
The metadata commands `--help`/`-h` and `--version`/`-v` must be used alone;
combining either one with a filename, another option, or each other is an error.
All argument validation happens before the input file is read.

## Example

```bash
node bin/agent-context-pruner.js examples/transcript.md --format markdown --max-items 8
```

The report includes counts, per-message classifications, redaction findings, and a continuation prompt guardrail.

## Safety Notes

- The tool is local-only and reads a file into memory.
- It writes reports to stdout and never edits the source transcript.
- Redaction detection is heuristic. Review `redact` and `verify` items manually before continuing a live agent.
- Do not use the generated brief as approval for connector writes or external account actions.


## Verification

Run the local quality gates before opening a pull request:

```sh
npm run lint
npm test
npm run smoke
```

`npm run lint` is an alias for the repository static check so contributors can use the common npm workflow without guessing the project-specific command.

## Limitations

- No model summarization is used.
- Very large transcripts should be chunked before running the MVP.
- Provider-token heuristics cover OpenAI `sk-...` and `sk-proj-...` shapes,
  underscore-delimited `sk_...`, GitHub `ghp_...` and `gho_...`, and Slack
  `xoxb_...` and `xoxp_...` shapes. Detection is not exhaustive and may miss
  domain-specific credentials.

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
library modules, skill instructions, runnable examples, release notes, and
security policy.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and vulnerability
reporting guidance. Keep real transcripts, secrets, and customer data out of
public issues and fixtures.
