#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(projectRoot, '.env.local'),
  override: false,
  quiet: true,
});

const env = {
  ...process.env,
  YANDEX_WEBMASTER_HOST_URL: process.env.YANDEX_WEBMASTER_HOST_URL || 'https://softwhere.uz',
};

if (!env.YANDEX_WEBMASTER_TOKEN) {
  console.error('YANDEX_WEBMASTER_TOKEN is missing.');
  console.error('Run: yarn mcp');
  console.error('If this is a new machine, run `npx vercel login` and `npx vercel link` first.');
  process.exit(1);
}

const child = spawn('npx', ['-y', 'yandex-webmaster-mcp'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  // Windows: npx is a .cmd shim that spawn() can only launch through cmd.exe.
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
