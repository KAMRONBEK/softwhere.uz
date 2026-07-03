#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(projectRoot, '.env.local'),
  override: false,
  quiet: true,
});

const encodedCredentials = process.env.GSC_SERVICE_ACCOUNT_JSON_BASE64;

if (!encodedCredentials) {
  console.error('GSC_SERVICE_ACCOUNT_JSON_BASE64 is missing.');
  console.error('Run: yarn mcp');
  console.error('If this is a new machine, run `npx vercel login` and `npx vercel link` first.');
  process.exit(1);
}

let credentialsJson;
try {
  credentialsJson = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  JSON.parse(credentialsJson);
} catch {
  console.error('GSC_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON.');
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softwhere-gsc-'));
const credentialsPath = path.join(tempDir, 'service-account.json');

const cleanup = () => {
  fs.rmSync(tempDir, { recursive: true, force: true });
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    cleanup();
    process.kill(process.pid, signal);
  });
}

fs.writeFileSync(credentialsPath, credentialsJson, { mode: 0o600 });

const child = spawn('npx', ['-y', '@vmandic/searchconsole-mcp'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  cleanup();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
