export function parseTranscript(raw, source = '<input>') {
  const text = raw.trim();
  if (!text) {
    return { source, format: 'empty', messages: [] };
  }
  if (looksLikeJsonl(text)) {
    return parseJsonlTranscript(text, source);
  }
  if (text.startsWith('[') || text.startsWith('{')) {
    return parseJsonTranscript(text, source);
  }
  return parseMarkdownTranscript(raw, source);
}

function parseJsonTranscript(text, source) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.messages || parsed.items || [];
  if (!Array.isArray(rows)) {
    throw new Error('JSON transcript must be an array or contain messages/items array');
  }
  return {
    source,
    format: 'json',
    messages: rows.map((row, index) => normalizeMessage(row, index))
  };
}

function parseJsonlTranscript(text, source) {
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  return {
    source,
    format: 'jsonl',
    messages: rows.map((row, index) => normalizeMessage(row, index))
  };
}

function parseMarkdownTranscript(raw, source) {
  const blocks = raw.split(/\n(?=#{1,6}\s|\*\*[^*]+:\*\*)/g).filter((block) => block.trim());
  const messages = blocks.length ? blocks : raw.split(/\n{2,}/).filter((block) => block.trim());
  return {
    source,
    format: 'markdown',
    messages: messages.map((content, index) => ({
      id: `m${index + 1}`,
      role: inferRole(content),
      content: content.trim(),
      line: lineNumberFor(raw, content)
    }))
  };
}

function normalizeMessage(row, index) {
  if (typeof row === 'string') {
    return { id: `m${index + 1}`, role: 'note', content: row };
  }
  return {
    id: String(row.id || row.message_id || `m${index + 1}`),
    role: String(row.role || row.author || row.type || 'note'),
    content: String(row.content || row.text || row.message || ''),
    timestamp: row.timestamp || row.created_at
  };
}

function looksLikeJsonl(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((line) => line.trim().startsWith('{') && line.trim().endsWith('}'));
}

function inferRole(content) {
  const first = content.trim().slice(0, 40).toLowerCase();
  if (first.includes('user')) return 'user';
  if (first.includes('assistant') || first.includes('agent')) return 'assistant';
  if (first.includes('tool')) return 'tool';
  return 'note';
}

function lineNumberFor(raw, needle) {
  const before = raw.slice(0, raw.indexOf(needle));
  return before ? before.split(/\r?\n/).length : 1;
}
