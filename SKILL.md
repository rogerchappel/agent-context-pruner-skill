# Agent Context Pruner Skill

Use this skill when an agent needs to continue from a long transcript, automation log, or handoff note and should preserve decisions while dropping noise.

## Required Inputs

- A local markdown transcript, a JSON array/object containing message objects,
  or a JSONL file with one message object per line
- The desired report format, either `json` or `markdown`

## Tools

- Local shell with Node.js 18 or newer
- No network access is required

## Side-Effect Boundaries

- Reads the transcript file
- Writes the report to stdout
- Does not mutate source files
- Does not call external services
- Does not approve or execute external actions

## Approval Requirements

Human approval is required before copying any continuation brief into a live agent run that can write to external systems. Items marked `verify` must be checked against source artifacts first. Items marked `redact` must not be reproduced verbatim.

## Example

```bash
node bin/agent-context-pruner.js examples/transcript.md --format markdown
```

The CLI grammar is:

```text
agent-context-pruner <input-file> [--format json|markdown] [--max-items n]
```

Both options require an explicit value, and `--max-items` must be a positive
integer.

## Validation

Run:

```bash
npm test
npm run check
npm run build
npm run smoke
```
