import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function readEnvironment(filePath) {
  return fs.existsSync(filePath) ? dotenv.parse(fs.readFileSync(filePath)) : {};
}

const rootEnvironment = readEnvironment(path.resolve('.env'));
const frontendEnvironment = readEnvironment(path.resolve('apps/frontend/.env'));
const environment = { ...rootEnvironment, ...frontendEnvironment, ...process.env };
const supabaseUrl = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL;
const supabasePublishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY
  || environment.VITE_SUPABASE_ANON_KEY
  || environment.SUPABASE_PUBLISHABLE_KEY
  || environment.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Desktop packaging requires the Supabase URL and publishable key in apps/frontend/.env or .env.');
}

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
  throw new Error('Desktop Supabase configuration must use HTTPS unless it targets local development.');
}

const outputDirectory = path.resolve('.desktop-build');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'config.json'), `${JSON.stringify({
  requestBodyLimit: environment.REQUEST_BODY_LIMIT || '256kb',
  supabasePublishableKey,
  supabaseUrl: parsedUrl.toString().replace(/\/$/, '')
}, null, 2)}\n`, { mode: 0o600 });
console.log('Prepared public desktop runtime configuration.');
