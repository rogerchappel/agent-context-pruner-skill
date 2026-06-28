import { findSensitiveSpans, redactText } from './redaction.js';

const SIGNALS = [
  { label: 'decision', action: 'keep', weight: 5, pattern: /\b(decided|decision|choose|chosen|must|requirement)\b/i },
  { label: 'next_action', action: 'keep', weight: 4, pattern: /\b(next|todo|follow up|remaining|blocked|verify)\b/i },
  { label: 'failure', action: 'verify', weight: 3, pattern: /\b(error|failed|blocked|timeout|denied|missing)\b/i },
  { label: 'artifact', action: 'keep', weight: 3, pattern: /\b(PR|commit|branch|file|path|repo|URL|artifact)\b/i },
  { label: 'verbose_tool_output', action: 'drop', weight: -2, pattern: /\b(stack trace|node_modules|download progress|npm notice)\b/i },
  { label: 'chatter', action: 'drop', weight: -1, pattern: /\b(thanks|sounds good|ok great)\b/i }
];

export function pruneTranscript(transcript, options = {}) {
  const maxItems = options.maxItems || 12;
  const items = transcript.messages.map((message) => classifyMessage(message));
  const keepers = items
    .filter((item) => ['keep', 'verify', 'redact'].includes(item.action))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .sort((a, b) => a.index - b.index);

  return {
    source: transcript.source,
    format: transcript.format,
    counts: {
      total: items.length,
      keep: items.filter((item) => item.action === 'keep').length,
      verify: items.filter((item) => item.action === 'verify').length,
      redact: items.filter((item) => item.action === 'redact').length,
      drop: items.filter((item) => item.action === 'drop').length
    },
    items,
    continuationBrief: buildBrief(keepers)
  };
}

function classifyMessage(message, index) {
  const findings = findSensitiveSpans(message.content);
  let score = message.content.length > 240 ? 1 : 0;
  const reasons = [];
  let action = 'drop';

  for (const signal of SIGNALS) {
    if (signal.pattern.test(message.content)) {
      score += signal.weight;
      reasons.push(signal.label);
      if (signal.weight > 0 && action === 'drop') action = signal.action;
      if (signal.action === 'verify') action = 'verify';
    }
  }

  if (findings.length) {
    action = 'redact';
    score += 6;
    reasons.push('sensitive_data');
  }
  if (!reasons.length && message.content.trim().length > 80) {
    action = 'keep';
    reasons.push('substantive_note');
    score += 1;
  }

  return {
    index,
    id: message.id,
    role: message.role,
    action,
    score,
    reasons,
    findings,
    summary: summarize(redactText(message.content))
  };
}

function summarize(content) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

function buildBrief(items) {
  return {
    keep: items.filter((item) => item.action === 'keep').map((item) => item.summary),
    verify: items.filter((item) => item.action === 'verify').map((item) => item.summary),
    redact: items.filter((item) => item.action === 'redact').map((item) => item.summary),
    nextPrompt: [
      'Continue from the preserved decisions and artifacts.',
      'Verify any items marked verify before taking external action.',
      'Do not reproduce redacted secrets or personal data.'
    ].join(' ')
  };
}
