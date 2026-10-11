import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { administratorSetupToken } from '../src/cloudDatabase.js';

// Read the private hosting secret from stdin rather than shell history or arguments.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const secret = Buffer.concat(chunks).toString('utf8').trim();
const base = new URL(process.env.APP_URL);
if (base.protocol !== 'https:')
  throw new Error('APP_URL must be the HTTPS address of your hosted site.');
base.pathname = '/auth';
base.search = '';
base.hash = 'setup=' + administratorSetupToken(secret);
const output = resolve(process.argv[2] || '.local/cloud-admin-activation.txt');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, base.href, { mode: 0o600 });
console.log(
  'Private administrator activation link saved locally. Open it and choose your own password within 48 hours.',
);
