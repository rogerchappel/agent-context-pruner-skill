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
  let rows;
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === 'object') {
    rows = parsed.messages ?? parsed.items;
    if (rows === undefined) {
      throw new Error('JSON transcript object must contain a messages or items array');
    }
    if (!Array.isArray(rows)) {
      throw new Error('JSON transcript messages/items value must be an array');
    }
  } else {
    throw new Error('JSON transcript must be an array or object with a messages/items array');
  }
  return {
    source,
    format: 'json',
    messages: rows.map((row, index) => normalizeMessage(row, index, 'JSON transcript'))
  };
}

function parseJsonlTranscript(text, source) {
  const rows = text.split(/\r?\n/)
    .map((line, index) => ({ line, position: index + 1 }))
    .filter(({ line }) => line.trim())
    .map(({ line, position }) => ({ row: JSON.parse(line), position }));
  return {
    source,
    format: 'jsonl',
    messages: rows.map(({ row, position }) => normalizeMessage(row, position - 1, 'JSONL transcript'))
  };
}

function parseMarkdownTranscript(raw, source) {
  const boundaries = new Set([0, raw.length]);

  for (const match of raw.matchAll(/\r?\n(?=#{1,6}\s|\*\*[^*\r\n]+:\*\*)|(?:\r?\n){2,}/g)) {
    boundaries.add(match.index + match[0].length);
  }

  const offsets = [...boundaries].sort((left, right) => left - right);
  const messages = offsets.slice(0, -1).flatMap((start, index) => {
    const segment = raw.slice(start, offsets[index + 1]);
    const leadingWhitespace = segment.match(/^\s*/)[0].length;
    const content = segment.trim();
    if (!content) return [];

    const contentOffset = start + leadingWhitespace;
    return [{
      id: `m${index + 1}`,
      role: inferRole(content),
      content,
      line: lineNumberAt(raw, contentOffset)
    }];
  }).map((message, index) => ({ ...message, id: `m${index + 1}` }));

  return {
    source,
    format: 'markdown',
    messages
  };
}

function normalizeMessage(row, index, context) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`${context} row ${index + 1} must be an object`);
  }
  const contentField = ['content', 'text', 'message']
    .find((field) => Object.hasOwn(row, field));
  if (!contentField) {
    throw new Error(`${context} row ${index + 1} must contain a textual content, text, or message field`);
  }
  if (typeof row[contentField] !== 'string') {
    throw new Error(`${context} row ${index + 1} field ${contentField} must be a string`);
  }
  return {
    id: String(row.id || row.message_id || `m${index + 1}`),
    role: String(row.role || row.author || row.type || 'note'),
    content: row[contentField],
    timestamp: row.timestamp || row.created_at
  };
}

function looksLikeJsonl(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return false;
  if (!lines[0].trim().startsWith('{')) return false;
  return lines.every((line) => {
    try {
      JSON.parse(line);
      return true;
    } catch {
      return false;
    }
  });
}

function inferRole(content) {
  const first = content.trim().slice(0, 40).toLowerCase();
  if (first.includes('user')) return 'user';
  if (first.includes('assistant') || first.includes('agent')) return 'assistant';
  if (first.includes('tool')) return 'tool';
  return 'note';
}

function lineNumberAt(raw, offset) {
  const before = raw.slice(0, offset);
  return before ? before.split(/\r?\n/).length : 1;
}
