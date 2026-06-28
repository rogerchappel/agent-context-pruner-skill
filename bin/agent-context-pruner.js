#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseTranscript } from '../src/parser.js';
import { pruneTranscript } from '../src/pruner.js';
import { toJsonReport, toMarkdownReport } from '../src/reporters.js';

function usage() {
  return `Usage: agent-context-pruner <input-file> [--format json|markdown] [--max-items n]

Creates a local pruning report for an agent transcript. Input may be markdown,
JSON message arrays, or JSONL message logs. No network calls are made.`;
}

function parseArgs(argv) {
  const args = { file: null, format: 'json', maxItems: 12 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (value === '--format') {
      args.format = argv[index + 1] || 'json';
      index += 1;
    } else if (value === '--max-items') {
      args.maxItems = Number(argv[index + 1]);
      index += 1;
    } else if (!args.file) {
      args.file = value;
    } else {
      throw new Error(`Unexpected argument: ${value}`);
    }
  }
  if (!Number.isInteger(args.maxItems) || args.maxItems < 1) {
    throw new Error('--max-items must be a positive integer');
  }
  if (!['json', 'markdown'].includes(args.format)) {
    throw new Error('--format must be json or markdown');
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!args.file) {
    console.error(usage());
    process.exit(2);
  }
  const raw = readFileSync(args.file, 'utf8');
  const transcript = parseTranscript(raw, args.file);
  const report = pruneTranscript(transcript, { maxItems: args.maxItems });
  console.log(args.format === 'markdown' ? toMarkdownReport(report) : toJsonReport(report));
} catch (error) {
  console.error(`agent-context-pruner: ${error.message}`);
  process.exit(1);
}
