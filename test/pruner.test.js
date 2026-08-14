import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
    ['{"role":"user"}\nnull', /JSONL transcript row 2 must be an object/]
  ];

  for (const [input, expected] of cases) {
    assert.throws(() => parseTranscript(input), expected);
  }
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

test('rejects repeated value options before reading the input', () => {
  const cases = [
    [['missing-transcript.md', '--format', 'json', '--format', 'markdown'], /--format may only be specified once/],
    [['missing-transcript.md', '--max-items', '1', '--max-items', '3'], /--max-items may only be specified once/]
  ];

  for (const [args, expected] of cases) {
    const result = spawnSync('node', ['bin/agent-context-pruner.js', ...args], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /ENOENT|missing-transcript/);
    assert.equal(result.stdout, '');
  }
});

test('requires help and version commands to be standalone', () => {
  const cases = [
    [['--help', 'missing-transcript.md'], /--help must be used alone/],
    [['-h', '--format', 'json'], /-h must be used alone/],
    [['--version', 'missing-transcript.md'], /--version must be used alone/],
    [['-v', '--max-items', '2'], /-v must be used alone/],
    [['--version', '--help'], /--version must be used alone/]
  ];

  for (const [args, expected] of cases) {
    const result = spawnSync('node', ['bin/agent-context-pruner.js', ...args], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
    assert.doesNotMatch(result.stderr, /ENOENT|missing-transcript/);
    assert.equal(result.stdout, '');
  }
});
