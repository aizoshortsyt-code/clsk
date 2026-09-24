# CLSK

Минимальный Telegram Mini App с серверной проверкой `initData`.

## Локальный запуск Windows

Создай `.env` из `.env.example` и заполни `BOT_TOKEN` токеном бота из BotFather:

```powershell
Copy-Item .env.example .env
notepad .env
```

Затем:

```powershell
pnpm.cmd install
pnpm.cmd dev
```

Открой http://localhost:5173. В обычном браузере Telegram `initData` отсутствует — это ожидаемо. Реальная проверка пользователя выполняется при открытии Mini App из Telegram.

## Telegram auth flow

1. Запусти frontend и API локально.
2. Создай HTTPS-туннель к frontend:

```powershell
.\cloudflared.exe tunnel --url http://localhost:5173
```

3. Создай второй туннель к API:

```powershell
.\cloudflared.exe tunnel --url http://localhost:4000
```

4. В `.env` укажи адрес второго туннеля:

```env
API_URL=https://YOUR-API-TUNNEL.trycloudflare.com
```

5. Перезапусти `pnpm.cmd dev` и укажи адрес frontend-туннеля в настройках Mini App через BotFather.

API endpoint:

- `GET /health`
- `GET /api/config`
- `GET /api/me?initData=...`
- `POST /api/me` с JSON `{ "initData": "..." }`

Сервер проверяет HMAC-SHA256, `hash`, наличие пользователя и срок `auth_date` (по умолчанию 24 часа). Невалидные данные возвращают HTTP 401 и не превращаются в verified-сессию.
