# Security Policy

## Supported Versions

`agent-context-pruner-skill` is pre-1.0. Security fixes are applied to the
latest published package and the `main` branch.

## Reporting a Vulnerability

Please report vulnerabilities through GitHub security advisories or by opening
a private maintainer contact path before sharing details publicly.

Include:

- the affected version or commit
- the input shape that triggers the issue
- whether transcript content, secrets, or local files can be exposed
- a minimal reproduction when it is safe to share

Do not include real credentials, private transcripts, customer logs, or other
sensitive data in public issues or fixtures.

## Scope

This tool reads local transcript files and writes reports to stdout. Security
reports are most useful when they involve unintended file access, disclosure of
redacted content, unsafe package contents, or CLI behavior that could mislead a
user into treating heuristic output as an approval.
