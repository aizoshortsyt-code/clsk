import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const botToken = process.env.BOT_TOKEN || '';
const maxAuthAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE || 86400);
const sessions = new Map();

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.WEB_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => {
      value += chunk;
      if (value.length > 1_000_000) reject(new Error('Request body too large'));
    });
    req.on('end', () => resolve(value));
    req.on('error', reject);
  });
}

function equalHash(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function verifyInitData(initData) {
  if (!botToken || !initData) return { ok: false, reason: 'guest' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  if (!equalHash(expected, hash)) return { ok: false, reason: 'invalid_hash' };

  const authDate = Number(params.get('auth_date'));
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isFinite(authDate) || age < -60 || age > maxAuthAge) return { ok: false, reason: 'expired_auth_date' };

  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user?.id) return { ok: false, reason: 'missing_user' };
    return { ok: true, user };
  } catch {
    return { ok: false, reason: 'invalid_user_json' };
  }
}

function defaultProfile(user, guest = false) {
  return {
    user: user || null,
    mode: guest ? 'guest' : 'verified',
    stats: { teams: 12, tasks: 86, completed: 64, pending: 31 },
    session: { active: false, startedAt: null }
  };
}

function profileFor(auth) {
  const key = auth.user ? String(auth.user.id) : 'guest';
  if (!sessions.has(key)) sessions.set(key, defaultProfile(auth.user, !auth.user));
  return sessions.get(key);
}

async function authFromRequest(req, url) {
  let initData = url.searchParams.get('initData') || '';
  if (!initData && req.method === 'POST') {
    const raw = await readBody(req);
    if (raw) {
      try { initData = JSON.parse(raw).initData || ''; } catch { initData = new URLSearchParams(raw).get('initData') || ''; }
    }
  }
  return verifyInitData(initData);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'clsk-api' });
  if (req.method === 'GET' && url.pathname === '/api/config') return sendJson(res, 200, { appName: 'CLSK', telegram: true, authConfigured: Boolean(botToken) });

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/me') {
    const auth = await authFromRequest(req, url);
    const profile = profileFor(auth);
    return sendJson(res, 200, { ok: true, ...profile, auth: { verified: auth.ok, reason: auth.ok ? null : auth.reason } });
  }

  if (req.method === 'POST' && url.pathname === '/api/session/start') {
    const auth = await authFromRequest(req, url);
    const profile = profileFor(auth);
    profile.session = { active: true, startedAt: new Date().toISOString() };
    return sendJson(res, 200, { ok: true, ...profile, message: 'Рабочая сессия начата' });
  }

  if (req.method === 'POST' && url.pathname === '/api/session/stop') {
    const auth = await authFromRequest(req, url);
    const profile = profileFor(auth);
    profile.session = { active: false, startedAt: null };
    return sendJson(res, 200, { ok: true, ...profile, message: 'Рабочая сессия остановлена' });
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => console.log(`CLSK API running at http://localhost:${port}`));
