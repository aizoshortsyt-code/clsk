# CLSK

Минимальный запускаемый Telegram Mini App starter.

## Windows

```powershell
pnpm.cmd install
pnpm.cmd dev
```

Откройте http://localhost:5173 и http://localhost:4000/health.

## Telegram Mini App

1. Запусти Cloudflare Tunnel:

```powershell
.
cloudflared.exe tunnel --url http://localhost:5173
```

2. Скопируй HTTPS URL вида `https://xxxxx.trycloudflare.com`.
3. Открой бота в Telegram и подключи Mini App.

## API

- `GET /health`
- `GET /api/config`
- `GET /api/me?initData=...`
- `POST /api/me` with JSON `{ initData: "..." }`

## Environment

```env
BOT_TOKEN=
```
