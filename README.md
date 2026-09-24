# CLSK

Минимальный запускаемый Telegram Mini App starter.

## Windows

```powershell
pnpm.cmd install
pnpm.cmd dev
```

Откройте http://localhost:5173 и http://localhost:4000/health.

Для PostgreSQL и Redis при наличии Docker:

```powershell
docker compose up -d
```

Для открытия Mini App в Telegram нужен публичный HTTPS URL. Например:

```powershell
cloudflared tunnel --url http://localhost:5173
```
