import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

async function loadEnv() {
  try {
    const text = await readFile(join(projectRoot, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}

await loadEnv();
const port = Number(process.env.WEB_PORT || 5173);
const apiBase = process.env.API_URL || 'http://localhost:4000';

const server = http.createServer(async (_req, res) => {
  try {
    let html = await readFile(join(root, 'index.html'), 'utf8');
    html = html.replaceAll('__CLSK_API_URL__', apiBase.replace(/\/$/, ''));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Frontend error');
  }
});

server.listen(port, () => console.log(`CLSK Mini App running at http://localhost:${port}`));
