import { accessSync, constants } from 'node:fs';

const required = [
  'README.md',
  'SKILL.md',
  'docs/PRD.md',
  'docs/TASKS.md',
  'docs/ORCHESTRATION.md',
  'docs/RELEASE_CANDIDATE.md',
  'bin/agent-context-pruner.js',
  'src/parser.js',
  'src/pruner.js',
  'src/reporters.js',
  'test/pruner.test.js'
];

for (const file of required) {
  accessSync(file, constants.R_OK);
}

console.log(`build-check: ${required.length} required files present`);
