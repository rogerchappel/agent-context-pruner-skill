import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTranscript } from '../src/parser.js';
import { pruneTranscript } from '../src/pruner.js';
import { findSensitiveSpans, redactText } from '../src/redaction.js';
import { toJsonReport, toMarkdownReport } from '../src/reporters.js';

test('parses markdown and flags keep, verify, and redact items', () => {
  const raw = readFileSync('test/fixtures/transcript.md', 'utf8');
  const transcript = parseTranscript(raw, 'fixture.md');
  const report = pruneTranscript(transcript);
  assert.equal(transcript.format, 'markdown');
  assert.equal(report.counts.redact, 1);
  assert.ok(report.counts.keep >= 1);
  assert.match(toMarkdownReport(report), /Continuation Brief/);
});

test('parses blank-line-separated Markdown transcript paragraphs', () => {
  const transcript = parseTranscript([
    'User: Decision: keep the local branch.',
    '',
    'Assistant: Next action: run the tests.'
  ].join('\n'));

  assert.deepEqual(transcript.messages, [
    { id: 'm1', role: 'user', content: 'User: Decision: keep the local branch.', line: 1 },
    { id: 'm2', role: 'assistant', content: 'Assistant: Next action: run the tests.', line: 3 }
  ]);
});

test('preserves heading-style Markdown boundaries', () => {
  const transcript = parseTranscript('## User\nKeep this\n## Assistant\nVerify that');

  assert.deepEqual(transcript.messages.map(({ role, line }) => ({ role, line })), [
    { role: 'user', line: 1 },
    { role: 'assistant', line: 3 }
  ]);
});

test('tracks repeated Markdown content by source offset', () => {
  const transcript = parseTranscript('User: same\n\nUser: same\n\nAssistant: done');

  assert.deepEqual(transcript.messages.map(({ content, line }) => ({ content, line })), [
    { content: 'User: same', line: 1 },
    { content: 'User: same', line: 3 },
    { content: 'Assistant: done', line: 5 }
  ]);
});

test('parses CRLF Markdown paragraphs with correct roles and lines', () => {
  const transcript = parseTranscript('User: first\r\n\r\nTool: result\r\n\r\nAssistant: last');

  assert.deepEqual(transcript.messages.map(({ role, line }) => ({ role, line })), [
    { role: 'user', line: 1 },
    { role: 'tool', line: 3 },
    { role: 'assistant', line: 5 }
  ]);
});

test('parses mixed heading and paragraph Markdown boundaries', () => {
  const transcript = parseTranscript([
    '# User',
    'Choose the stable API.',
    '',
    '**Tool:** inspected the package',
    '## Assistant',
    'Implement the focused fix.'
  ].join('\n'));

  assert.deepEqual(transcript.messages.map(({ role, line }) => ({ role, line })), [
    { role: 'user', line: 1 },
    { role: 'tool', line: 4 },
    { role: 'assistant', line: 5 }
  ]);
});

test('parses JSONL transcript logs', () => {
  const raw = readFileSync('test/fixtures/transcript.jsonl', 'utf8');
  const report = pruneTranscript(parseTranscript(raw, 'fixture.jsonl'));
  assert.equal(report.format, 'jsonl');
  assert.equal(report.counts.verify, 1);
});

test('parses JSON message arrays', () => {
  const report = pruneTranscript(parseTranscript(JSON.stringify([
    { role: 'user', content: 'Decision: preserve branch release-candidate/demo.' },
    { role: 'tool', content: 'thanks ok great' }
  ])));
  assert.equal(report.counts.total, 2);
  assert.equal(report.items[0].action, 'keep');
  assert.equal(report.items[0].index, 0);
  assert.equal(report.items[1].index, 1);
});

test('parses JSON objects with messages or items arrays', () => {
  const messages = parseTranscript('{"messages":[{"role":"user","content":"Keep this"}]}');
  const items = parseTranscript('{"items":[{"role":"assistant","text":"And this"}]}');

  assert.equal(messages.messages[0].content, 'Keep this');
  assert.equal(items.messages[0].content, 'And this');
});

test('rejects JSON objects without a message array', () => {
  for (const input of ['{}', '{"metadata":{"count":4}}']) {
    assert.throws(
      () => parseTranscript(input),
      { message: 'JSON transcript object must contain a messages or items array' }
    );
  }
});

test('rejects unsupported JSON and JSONL message rows with stable errors', () => {
  const cases = [
    ['{"messages":[null]}', /JSON transcript row 1 must be an object/],
    ['{"messages":[42]}', /JSON transcript row 1 must be an object/],
    ['{"messages":["text"]}', /JSON transcript row 1 must be an object/],
    ['{"role":"user","content":"first"}\nnull', /JSONL transcript row 2 must be an object/]
  ];

  for (const [input, expected] of cases) {
    assert.throws(() => parseTranscript(input), expected);
  }
});

test('requires textual content fields in JSON arrays and wrapper objects', () => {
  const cases = [
    ['[{"role":"user"}]', 'JSON transcript row 1 must contain a textual content, text, or message field'],
    ['{"messages":[{"content":null}]}', 'JSON transcript row 1 field content must be a string'],
    ['{"items":[{"text":false}]}', 'JSON transcript row 1 field text must be a string'],
    ['[{"message":42}]', 'JSON transcript row 1 field message must be a string'],
    ['[{"content":{}}]', 'JSON transcript row 1 field content must be a string'],
    ['[{"content":[]}]', 'JSON transcript row 1 field content must be a string']
  ];

  for (const [input, message] of cases) {
    assert.throws(() => parseTranscript(input), { message });
  }
});

test('requires textual content fields in JSONL rows with physical line positions', () => {
  const input = [
    '{"content":"first"}',
    '',
    '{"role":"assistant"}',
    '{"message":true}'
  ].join('\n');

  assert.throws(
    () => parseTranscript(input),
    { message: 'JSONL transcript row 3 must contain a textual content, text, or message field' }
  );
});

test('preserves intentionally empty and whitespace-only message strings', () => {
  const transcript = parseTranscript(JSON.stringify([
    { content: '' },
    { text: '   ' },
    { message: '\t' }
  ]));

  assert.deepEqual(transcript.messages.map(({ content }) => content), ['', '   ', '\t']);
});

test('redacts sk-proj secrets from JSON and Markdown reports', () => {
  const secret = 'sk-proj-abcdefghijklmnopqrstuv';
  const report = pruneTranscript(parseTranscript(JSON.stringify([
    { role: 'user', content: `Token ${secret} should be redacted` }
  ])));
  const outputs = [toJsonReport(report), toMarkdownReport(report)];

  assert.equal(report.counts.redact, 1);
  assert.equal(report.items[0].action, 'redact');
  assert.deepEqual(report.items[0].findings.map((finding) => finding.kind), ['secret']);
  for (const output of outputs) {
    assert.doesNotMatch(output, new RegExp(secret));
    assert.match(output, /\[REDACTED:secret\]/);
  }
});

test('redacts legacy sk secrets from JSON and Markdown reports', () => {
  const secret = 'sk-abcdefghijklmnopqrstuvwx';
  const report = pruneTranscript(parseTranscript(JSON.stringify([
    { role: 'user', content: `Decision: token ${secret}` }
  ])));
  const outputs = [toJsonReport(report), toMarkdownReport(report)];

  assert.equal(report.counts.redact, 1);
  assert.equal(report.items[0].action, 'redact');
  assert.deepEqual(report.items[0].findings.map((finding) => finding.kind), ['secret']);
  assert.doesNotMatch(JSON.stringify(report.items[0].findings), new RegExp(secret));
  for (const output of outputs) {
    assert.doesNotMatch(output, new RegExp(secret));
    assert.match(output, /\[REDACTED:secret\]/);
  }
});

test('recognizes documented provider token shapes without retaining full values', () => {
  const tokens = [
    'sk-abcdefghijklmnopqrstuvwx',
    'sk-proj-abcdefghijklmnopqrstuv',
    'sk_test_example_should_redact',
    'ghp_abcdefghijklmnop',
    'gho_abcdefghijklmnop',
    'xoxb_abcdefghijklmnop',
    'xoxp_abcdefghijklmnop'
  ];

  for (const token of tokens) {
    const findings = findSensitiveSpans(`Token: ${token}`);
    assert.deepEqual(findings.map((finding) => finding.kind), ['secret']);
    assert.doesNotMatch(JSON.stringify(findings), new RegExp(token));
    assert.equal(redactText(`Token: ${token}`), 'Token: [REDACTED:secret]');
  }
});

test('does not redact benign secret-shaped prose or short lookalikes', () => {
  const benignValues = [
    'sk-this-is-ordinary-hyphenated-prose',
    'sk-abcdefghijklmnopqrstuvwx-example',
    'sk-short',
    'ask-abcdefghijklmnopqrstuvwx',
    'ghp_short',
    'xoxb_not-a-token'
  ];

  for (const value of benignValues) {
    assert.deepEqual(findSensitiveSpans(value), []);
    assert.equal(redactText(value), value);
  }
});

test('handles empty input', () => {
  const report = pruneTranscript(parseTranscript('   '));
  assert.equal(report.counts.total, 0);
  assert.deepEqual(report.continuationBrief.keep, []);
});

test('prints usage help', () => {
  const output = execFileSync('node', ['bin/agent-context-pruner.js', '--help'], { encoding: 'utf8' });
  assert.match(output, /Usage: agent-context-pruner/);
  assert.match(output, /--format json\|markdown/);
  assert.match(output, /--max-items n/);
});

test('prints the package version', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const output = execFileSync('node', ['bin/agent-context-pruner.js', '--version'], { encoding: 'utf8' });
  assert.equal(output.trim(), packageJson.version);
});

test('requires values for CLI options', () => {
  for (const option of ['--format', '--max-items']) {
    const result = spawnSync('node', ['bin/agent-context-pruner.js', 'examples/transcript.md', option], {
      encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${option} requires a value`));
    assert.equal(result.stdout, '');
  }
});

test('rejects unknown CLI options consistently', () => {
  for (const args of [
    ['--unknown'],
    ['examples/transcript.md', '--unknown']
  ]) {
    const result = spawnSync('node', ['bin/agent-context-pruner.js', ...args], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option: --unknown/);
    assert.equal(result.stdout, '');
  }
});

test('CLI reports invalid message content for JSON arrays, wrappers, and JSONL', () => {
  const directory = mkdtempSync(join(tmpdir(), 'context-pruner-content-'));
  const cases = [
    ['array.json', '[{"content":12}]', /JSON transcript row 1 field content must be a string/],
    ['wrapper.json', '{"messages":[{"role":"user"}]}', /JSON transcript row 1 must contain a textual content/],
    ['messages.jsonl', '{"text":"ok"}\n{"message":null}\n', /JSONL transcript row 2 field message must be a string/]
  ];

  try {
    for (const [name, input, expected] of cases) {
      const file = join(directory, name);
      writeFileSync(file, input);
      const result = spawnSync('node', ['bin/agent-context-pruner.js', file], { encoding: 'utf8' });

      assert.equal(result.status, 1);
      assert.match(result.stderr, expected);
      assert.equal(result.stdout, '');
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
