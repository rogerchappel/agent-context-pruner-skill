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

function packageVersion() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return packageJson.version;
}

function parseArgs(argv) {
  const args = { file: null, format: 'json', maxItems: 12 };
  const seenOptions = new Set();
  const optionValue = (index, option) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('-')) {
      throw new Error(`${option} requires a value`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      if (argv.length !== 1) {
        throw new Error(`${value} must be used alone`);
      }
      args.help = true;
    } else if (value === '--version' || value === '-v') {
      if (argv.length !== 1) {
        throw new Error(`${value} must be used alone`);
      }
      args.version = true;
    } else if (value === '--format') {
      if (seenOptions.has(value)) {
        throw new Error(`${value} may only be specified once`);
      }
      seenOptions.add(value);
      args.format = optionValue(index, value);
      index += 1;
    } else if (value === '--max-items') {
      if (seenOptions.has(value)) {
        throw new Error(`${value} may only be specified once`);
      }
      seenOptions.add(value);
      args.maxItems = Number(optionValue(index, value));
      index += 1;
    } else if (value.startsWith('-')) {
      throw new Error(`Unknown option: ${value}`);
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
  if (args.version) {
    console.log(packageVersion());
    process.exit(0);
  }
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
