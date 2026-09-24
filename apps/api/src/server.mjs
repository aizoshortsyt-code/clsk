import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 4000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
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

function parseInitData(initData) {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const sorted = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = sorted.map(([key, value]) => `${key}=${value}`).join('\n');

  if (!BOT_TOKEN) {
    return { hash, dataCheckString, user: null };
  }

  const key = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', key).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) {
    return { hash, dataCheckString, user: null, invalid: true };
  }

  const user = JSON.parse(params.get('user') || 'null');
  return { hash, dataCheckString, user, invalid: false };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'clsk-api' });
    return;
  }

  if (req.url === '/api/config') {
    sendJson(res, 200, {
      appName: 'CLSK',
      telegram: true,
      env: process.env.NODE_ENV || 'development'
    });
    return;
  }

  if (req.url.startsWith('/api/me')) {
    try {
      let initData = url.searchParams.get('initData') || '';

      if (!initData && req.method === 'POST') {
        const raw = await getBody(req);
        if (raw) {
          try {
            const json = JSON.parse(raw);
            initData = json.initData || '';
          } catch {
            const parsed = new URLSearchParams(raw);
            initData = parsed.get('initData') || '';
          }
        }
      }

      const verified = parseInitData(initData);

      if (!verified || verified.invalid || !verified.user) {
        sendJson(res, 200, {
          ok: true,
          mode: 'guest',
          user: null,
          message: 'Telegram initData not provided or not valid'
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        mode: 'verified',
        user: verified.user,
        message: 'Telegram profile verified'
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error.message || 'Unexpected error'
      });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`CLSK API running at http://localhost:${port}`);
});
