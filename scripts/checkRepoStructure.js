import fs from 'node:fs';

const required = [
  'README.md',
  '.env.example',
  'scripts/initCosmos.js',
  'scripts/seedGhostData.js',
  'scripts/verifyCosmos.js',
  'docs/EER.md',
  'docs/COSMOS_DB.md',
  'docs/UI_SPEC.md',
  'docs/AI_AGENT_PROMPTS.md',
  'apps/frontend/package.json',
  'apps/api/package.json'
];

let failed = false;
for (const path of required) {
  if (!fs.existsSync(path)) {
    console.error(`Missing required file: ${path}`);
    failed = true;
  } else {
    console.log(`✓ ${path}`);
  }
}

if (failed) process.exit(1);
console.log('Repository structure check passed.');
