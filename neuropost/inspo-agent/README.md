# 🎨 NeuroPost Inspo Agent

Curaduría de inspiración visual con aprobación por ❤️ en Telegram.
**100% GitHub Actions — sin servidores, sin servicios externos, gratis.**

## Flujo

```
01:00 AM — GitHub Actions
  agent.py busca en Pinterest (400 queries)
  Claude filtra con criterio estético
  Envía cada pin como FOTO o VIDEO nativo al canal
  Guarda en Supabase como 'pending'
        ↓
  Tú abres Telegram y das ❤️ a los que te gustan
        ↓
Cada hora — GitHub Actions
  sync_reactions.py lee qué mensajes tienen ❤️
  Esos pasan a 'approved' en Supabase
        ↓
Tu web lee de approved_pins en Supabase
```

## Archivos

| Archivo | Qué hace |
|---------|----------|
| `agent.py` | Crawler nocturno — busca, filtra, envía |
| `sync_reactions.py` | Lee ❤️ de Telegram, aprueba en Supabase |
| `queries.json` | 400 queries por negocio y categoría |
| `supabase_migration.sql` | Crea la tabla en Supabase |

## Setup

### 1. Canal de Telegram
1. Telegram → nuevo canal → **privado** → llámalo "NeuroPost Inspo"
2. Añade tu bot como **administrador** (necesita permiso de enviar mensajes)
3. Obtén el `channel_id`:
   - Envía un mensaje al canal
   - Abre: `https://api.telegram.org/botTU_TOKEN/getUpdates`
   - Busca `"chat":{"id":-100XXXXXXXXX}` — ese es tu channel_id

### 2. Supabase
Ejecuta `supabase_migration.sql` en el SQL Editor de tu proyecto NeuroPost.

### 3. GitHub Secrets
Settings → Secrets → Actions → New repository secret:

| Secret | Valor |
|--------|-------|
| `PINTEREST_ACCESS_TOKEN` | Token OAuth Pinterest |
| `ANTHROPIC_API_KEY` | Tu API key Anthropic |
| `SUPABASE_URL` | URL de tu Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
| `TELEGRAM_CHANNEL_ID` | `-100XXXXXXXXX` del canal |

### 4. Subir al repo
```bash
git add .
git commit -m "feat: neuropost inspo agent"
git push
```

### 5. Probar
GitHub → Actions → "Buscar inspiración" → Run workflow

## Cómo aprobar

Abres Telegram, ves los pins que llegaron por la noche.
Los que te gustan → ❤️ (o 🔥 👍 — todos cuentan como aprobado).
En la próxima hora el sync los mueve a `approved` en Supabase.

## Usar los pins en tu web

```typescript
// Next.js / NeuroPost
const { data } = await supabase
  .from('approved_pins')
  .select('*')
  .eq('negocio', 'gym')   // opcional
  .limit(20)
```
