export function toJsonReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function toMarkdownReport(report) {
  const lines = [
    `# Agent Context Pruning Report`,
    ``,
    `Source: ${report.source}`,
    `Format: ${report.format}`,
    `Counts: keep ${report.counts.keep}, verify ${report.counts.verify}, redact ${report.counts.redact}, drop ${report.counts.drop}`,
    ``,
    `## Continuation Brief`,
    ``,
    `### Keep`,
    ...bullet(report.continuationBrief.keep),
    ``,
    `### Verify`,
    ...bullet(report.continuationBrief.verify),
    ``,
    `### Redact`,
    ...bullet(report.continuationBrief.redact),
    ``,
    `### Prompt Guardrail`,
    report.continuationBrief.nextPrompt,
    ``,
    `## Classified Items`,
    ...report.items.map((item) => `- ${item.id} [${item.action}] ${item.reasons.join(', ') || 'no signal'}: ${item.summary}`)
  ];
  return `${lines.join('\n')}\n`;
}

function bullet(items) {
  return items.length ? items.map((item) => `- ${item}`) : ['- None'];
}
