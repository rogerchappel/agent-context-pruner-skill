import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
