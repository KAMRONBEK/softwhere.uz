#!/usr/bin/env node

const path = require('node:path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(projectRoot, '.env.local'),
  override: false,
  quiet: true,
});

const required = ['YANDEX_WEBMASTER_TOKEN', 'GSC_SERVICE_ACCOUNT_JSON_BASE64'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing MCP env value(s): ${missing.join(', ')}`);
  console.error('If Vercel pulled empty values, those variables are probably marked Sensitive.');
  console.error('Vercel Sensitive env vars are write-only and cannot be used as a local sync source.');
  console.error('Use non-sensitive Vercel env vars for MCP sync, or store these secrets locally/with a password manager.');
  process.exit(1);
}

try {
  const credentialsJson = Buffer.from(process.env.GSC_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8');
  const credentials = JSON.parse(credentialsJson);

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('missing service account fields');
  }
} catch {
  console.error('GSC_SERVICE_ACCOUNT_JSON_BASE64 must be a valid base64-encoded Google service account JSON.');
  process.exit(1);
}

console.log('MCP env is ready.');
