import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

async function loadEnv() {
  try {
    const text = await readFile(join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}

await loadEnv();

const port = Number(process.env.PORT || 4000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MAX_AUTH_AGE_SECONDS = Number(process.env.TELEGRAM_AUTH_MAX_AGE || 86400);

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.WEB_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
  });
  res.end(JSON.stringify(payload));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function verifyInitData(initData) {
  if (!BOT_TOKEN || !initData) return { ok: false, reason: 'missing_bot_token_or_init_data' };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return { ok: false, reason: 'missing_hash' };

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!safeEqualHex(expectedHash, receivedHash)) return { ok: false, reason: 'invalid_hash' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: 'expired_auth_date' };
  }

  let user;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return { ok: false, reason: 'invalid_user_json' };
  }

  if (!user || !user.id) return { ok: false, reason: 'missing_user' };
  return { ok: true, user };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'clsk-api' });
  if (req.method === 'GET' && url.pathname === '/api/config') {
    return sendJson(res, 200, { appName: 'CLSK', telegram: true, authConfigured: Boolean(BOT_TOKEN) });
  }

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/me') {
    try {
      let initData = url.searchParams.get('initData') || '';
      if (!initData && req.method === 'POST') {
        const raw = await getBody(req);
        try { initData = JSON.parse(raw).initData || ''; } catch { initData = new URLSearchParams(raw).get('initData') || ''; }
      }

      const result = verifyInitData(initData);
      if (!result.ok) return sendJson(res, 401, { ok: false, mode: 'guest', user: null, error: result.reason });
      return sendJson(res, 200, { ok: true, mode: 'verified', user: result.user });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message || 'Invalid request' });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => console.log(`CLSK API running at http://localhost:${port}`));
