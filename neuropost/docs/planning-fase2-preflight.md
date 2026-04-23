# Planning Fase 2 — Preflight

> **Fecha:** 2026-04-23

## 1. Patrón de autenticación de crons (dominante)

22 de 28 crons usan este patrón dual (`x-vercel-cron` + Bearer):

```typescript
const auth      = request.headers.get('authorization');
const isVercel  = request.headers.get('x-vercel-cron') === '1';
const secret    = process.env.CRON_SECRET ?? '';
const validBearer = secret && auth === `Bearer ${secret}`;
if (!isVercel && !validBearer) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Los 4 restantes usan solo Bearer (sin fallback `x-vercel-cron`). Fase 2 usa el patrón dominante.

## 2. Shape de respuesta estándar

```typescript
// Éxito
NextResponse.json({ ok: true, ...countFields })
// Error 500
NextResponse.json({ ok: false, error: msg }, { status: 500 })
// 401
NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

## 3. Logging existente vs Fase 2

Los crons existentes usan `console.error/warn/log` con prefijo `[nombre-cron]`. 
Fase 2 usará `log()` de `src/lib/logger.ts` (introducido en Fase 0) para ser 
consistente con el resto del pipeline de planificación.

## 4. `vercel.json` — crons actuales

24 entradas. Más frecuentes: `* * * * *` (agent-queue-runner, process-agent-replies, 
flush-notifications, inspiration/ingest). Menos frecuentes: mensual, semanal.
Los tres nuevos crons de Fase 2 encajan en frecuencias `*/2`, `*/5`, `*/15`.

## 5. Configuración de `maxDuration`

| Cron | `maxDuration` |
|---|---|
| agent-queue-runner | 300s |
| health-check | 30s |
| email-queue-processor | 60-120s |
| reconcile-predictions | 60s |

Fase 2:
- `reconcile-renders` → **30s** (fire-and-forget; no espera respuesta del render)
- `reconcile-client-emails` → **60s** (llama enqueueClientReviewEmail que es async)
- `detect-stuck-plans` → **30s** (solo UPDATEs de DB)

## 6. INTERNAL_RENDER_TOKEN

No existe en el proyecto antes de Fase 2. Fase 2 lo introduce como variable de 
entorno opcional para autenticar llamadas internas al endpoint de render.

Impacto:
- Render endpoint: soft-check (solo enforced si la env var está definida)  
- plan-week.ts: pasa el token si está definido
- reconcile-renders cron: require que esté definida (falla con 500 si no)

Esta decisión permite onboarding progresivo: staging/dev puede funcionar sin el 
token; producción debe tenerlo configurado.

## 7. Patrón de claim atómico

Supabase JS v2 no soporta `FOR UPDATE SKIP LOCKED` directamente. El proyecto 
usa el patrón de UPDATE condicional:

```typescript
const { data: claimed } = await db
  .from('table')
  .update({ status: 'claimed_state' })
  .eq('id', id)
  .in('status', ['claimable_states'])
  .select('id');
if (!claimed?.length) continue; // otro worker lo tomó
```

Este patrón ya está en el render endpoint (Fase 1) y se replica aquí.

## 8. Variables de entorno requeridas por Fase 2

| Variable | Origen | Requerida |
|---|---|---|
| `CRON_SECRET` | Ya existe | Sí |
| `INTERNAL_RENDER_TOKEN` | Nueva en Fase 2 | Sí en prod, opcional en dev |
| `NEXT_PUBLIC_SITE_URL` | Ya existe | Sí (para construir URLs de render) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya existe | Sí |

## 9. Sin surpresas — puede continuar a Paso 1

- Patrón de crons: claro y consistente
- vercel.json con sección `crons`: confirmado
- `createAdminClient` = service_role (bypass RLS): confirmado
- No hay `FOR UPDATE SKIP LOCKED` en JS pero el patrón de UPDATE condicional es equivalente
- `INTERNAL_RENDER_TOKEN` es nuevo — requiere añadirlo a env y al render endpoint
