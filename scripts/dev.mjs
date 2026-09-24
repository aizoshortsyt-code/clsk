import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

try {
  const env = await readFile('.env', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

const isWindows = process.platform === 'win32';
const command = isWindows ? 'pnpm.cmd' : 'pnpm';
const children = [['apps/api', 'dev'], ['apps/web', 'dev']].map(([dir, script]) =>
  spawn(command, ['--dir', dir, script], {
    stdio: 'inherit',
    env: process.env,
    shell: isWindows
  })
);

const stop = () => {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
