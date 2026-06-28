import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTranscript } from '../src/parser.js';
import { pruneTranscript } from '../src/pruner.js';
import { toMarkdownReport } from '../src/reporters.js';

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
});

test('handles empty input', () => {
  const report = pruneTranscript(parseTranscript('   '));
  assert.equal(report.counts.total, 0);
  assert.deepEqual(report.continuationBrief.keep, []);
});
