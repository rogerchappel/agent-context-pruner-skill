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
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  return {
    source,
    format: 'jsonl',
    messages: rows.map((row, index) => normalizeMessage(row, index, 'JSONL transcript'))
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

function normalizeMessage(row, index, context) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`${context} row ${index + 1} must be an object`);
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

function lineNumberFor(raw, needle) {
  const before = raw.slice(0, raw.indexOf(needle));
  return before ? before.split(/\r?\n/).length : 1;
}
