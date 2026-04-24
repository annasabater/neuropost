# Planning Fase 2 — Reporte de implementación

> **Fecha:** 2026-04-23

## Resumen

Tres crons de reconciliación que cierran el loop de durabilidad iniciado en Fase 1.
Cualquier efecto crítico del pipeline de planificación (render, email al cliente,
notificación al worker) que falle en el momento, ahora se recupera automáticamente
sin intervención manual.

## Endpoints creados

| Endpoint | Schedule | `maxDuration` | Propósito |
|---|---|---|---|
| `/api/cron/reconcile-renders` | `*/2 * * * *` | 30s | Re-dispara renders pendientes/fallados |
| `/api/cron/reconcile-client-emails` | `*/5 * * * *` | 60s | Reintenta emails fallados al cliente |
| `/api/cron/detect-stuck-plans` | `*/15 * * * *` | 30s | Expira planes atascados/abandonados |

## Variables de entorno requeridas (Fase 2 añade)

| Variable | Descripción | Requerida |
|---|---|---|
| `INTERNAL_RENDER_TOKEN` | Bearer token para autenticar llamadas internas al render endpoint | **Sí en prod**, opcional en dev |

Las demás (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`) ya existían.

**Cómo generar `INTERNAL_RENDER_TOKEN`:**
```bash
openssl rand -hex 32
```
Añadir a `.env.local` y a las variables de entorno de Vercel.

## Archivos creados/modificados

### Nuevos
- `src/app/api/cron/reconcile-renders/route.ts`
- `src/app/api/cron/reconcile-client-emails/route.ts`
- `src/app/api/cron/detect-stuck-plans/route.ts`
- `scripts/verify-planning-fixes-fase2.ts`
- `docs/planning-fase2-preflight.md`
- `docs/planning-fase2-report.md` (este archivo)

### Modificados
- `vercel.json` — 3 nuevas entradas en `crons`
- `src/app/api/render/story/[idea_id]/route.ts` — soft auth con `INTERNAL_RENDER_TOKEN`
- `src/lib/agents/strategy/plan-week.ts` — pasa token en fire-and-forget renders

## Cómo monitorizar en producción

### Queries SQL útiles

```sql
-- Renders pendientes hace más de 5 minutos (debería ser 0 en estado sano)
SELECT id, render_status, render_attempts, render_started_at
FROM content_ideas
WHERE content_kind = 'story'
  AND render_status IN ('pending_render', 'render_failed')
  AND created_at < now() - interval '5 minutes'
ORDER BY created_at;

-- Ideas permanentemente falladas (render_attempts >= 3)
SELECT id, render_error, render_attempts, created_at
FROM content_ideas
WHERE render_status = 'render_failed' AND render_attempts >= 3
ORDER BY created_at DESC LIMIT 20;

-- Emails de cliente fallados (debería ser 0 o decreciendo)
SELECT id, client_email_status, client_email_attempts, created_at
FROM weekly_plans
WHERE client_email_status = 'failed'
ORDER BY created_at DESC LIMIT 20;

-- Planes atascados en 'generating' > 10 min (indica crash del handler)
SELECT id, brand_id, status, skip_reason, created_at
FROM weekly_plans
WHERE status = 'generating'
  AND created_at < now() - interval '10 minutes';

-- Planes worker-unnotificados > 30 min (señal de alerta)
SELECT id, brand_id, worker_notify_status, created_at
FROM weekly_plans
WHERE status = 'ideas_ready'
  AND worker_notify_status IN ('pending', 'failed')
  AND created_at < now() - interval '30 minutes';
```

### Logs a buscar en Vercel (por scope)

| Scope | Event | Nivel | Qué indica |
|---|---|---|---|
| `cron/reconcile-renders` | `idea_permanently_failed` | WARN | Render definitivamente roto para esa idea |
| `cron/reconcile-renders` | `stuck_rendering_reset` | WARN | Renders que se colgaron (timeout/crash) |
| `cron/reconcile-renders` | `missing_render_token` | ERROR | `INTERNAL_RENDER_TOKEN` no configurado |
| `cron/reconcile-client-emails` | `email_permanently_failed` | ERROR | Email no se pudo enviar en 3 intentos |
| `cron/detect-stuck-plans` | `plan_stuck_generating_expired` | ERROR | El handler de plan_week crasheó |
| `cron/detect-stuck-plans` | `plan_worker_unnotified` | WARN | Worker no fue notificado en >30 min |

## Edge cases conocidos

### Vercel deploy durante un cron en curso

Si Vercel despliega una nueva versión mientras `reconcile-renders` está disparando
renders fire-and-forget:
- Los fetches fire-and-forget se pierden si la función termina antes de que el
  TCP connection se establezca
- Los renders que no llegaron a dispararse seguirán en `pending_render`
- La próxima invocación del cron (2 min después) los recogerá
- **Impacto:** Retardo de máximo 2 minutos en renders. Aceptable.

### Dos invocaciones simultáneas del mismo cron

Vercel puede (raramente) ejecutar dos instancias del mismo cron solapadas:
- `reconcile-renders`: Las dos ven los mismos `pending_render`. Ambas intentan
  disparar el render endpoint. El segundo POST recibe 409 (atomic claim del
  render endpoint, Fase 1). Ningún trabajo duplicado.
- `reconcile-client-emails`: El claim atómico (`UPDATE WHERE status='failed'`)
  garantiza que solo una instancia procesa cada plan. Segunda instancia obtiene
  0 filas claimed → skip.
- `detect-stuck-plans`: Los UPDATEs de Postgres son atómicos. Dos instancias
  simultáneas actualizan el mismo plan → ambas lo marcan 'expired'. El resultado
  es el mismo, sin daño.

### `INTERNAL_RENDER_TOKEN` no configurado en dev

- El render endpoint NO rechaza requests sin token si la variable no está set
  (soft check)
- `reconcile-renders` sí falla con 500 si la variable no está set
- Para desarrollo local sin el token: las llamadas desde `plan-week.ts` siguen
  funcionando. Solo el reconcile cron fallará → no afecta el flujo principal.

### Plan de test con `created_at` manipulado

El script de verificación hace `UPDATE created_at` para simular planes viejos.
Esto solo funciona porque el cliente es service_role. En producción, RLS
impediría que los clients manipulen `created_at`.

## Decisiones de diseño

| Decisión | Justificación |
|---|---|
| `INTERNAL_RENDER_TOKEN` soft (no mandatory) en el endpoint | Permite dev local sin configuración extra; producción lo refuerza vía cron que falla si no está set |
| `FOR UPDATE SKIP LOCKED` sustituido por UPDATE condicional | Supabase JS v2 no expone SQL crudo; el UPDATE con WHERE en el estado esperado es equivalente para nuestro caso |
| `render_attempts` incrementado por el cron, no por el endpoint | El endpoint mide fallos del render real; el cron mide intentos de recuperación — conceptualmente distintos |
| Fire-and-forget en reconcile-renders (no await) | Mantiene el cron por debajo de 30s; el render puede tardar hasta 90s (Replicate polling) |
| Logs a nivel ERROR para `plan_stuck_generating_expired` | Es una señal de crash del handler, no un fallo operacional normal |
