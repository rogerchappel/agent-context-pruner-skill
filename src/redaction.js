const PATTERNS = [
  { kind: 'secret', pattern: /\b(?:sk|ghp|gho|xoxb|xoxp)_[A-Za-z0-9_=-]{12,}\b/g },
  { kind: 'aws_key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { kind: 'phone', pattern: /\b(?:\+?\d[\d .()-]{8,}\d)\b/g },
  { kind: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/g }
];

export function findSensitiveSpans(content) {
  const findings = [];
  for (const { kind, pattern } of PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      findings.push({
        kind,
        value: mask(match[0]),
        index: match.index ?? 0
      });
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

export function redactText(content) {
  let redacted = content;
  for (const { kind, pattern } of PATTERNS) {
    redacted = redacted.replace(pattern, `[REDACTED:${kind}]`);
  }
  return redacted;
}

function mask(value) {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
