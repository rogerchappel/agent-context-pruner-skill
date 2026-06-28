# Orchestration

## Inputs

- A local transcript file in markdown, JSON, or JSONL format
- Optional output format and maximum retained items

## Flow

1. Read the transcript locally.
2. Normalize entries into role/content messages.
3. Detect sensitive spans before summarizing.
4. Classify each entry as keep, drop, verify, or redact.
5. Emit a report for a human or agent to review before continuation.

## Side Effects

The CLI reads local files and writes only to stdout. It does not call networks, mutate transcripts, or approve external actions.

## Failure Handling

Invalid JSON, unsupported CLI flags, and missing files return a non-zero exit code with a concise error message.
