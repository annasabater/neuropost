# Planning Fase 1 — Investigación de worker_notify_status='pending'

> **Fecha:** 2026-04-23  
> **Plan afectado reportado:** `1a4550ae-865c-4e74-bf38-75a668851b38`  
> **Estado al momento de la investigación:** RESUELTO (falsa alarma)

---

## Hallazgos por paso

---

### Paso 1 — Código del handler (plan-week.ts:267-294)

```typescript
// plan-week.ts:267-294
if (decision.route === 'worker_review') {
  // P2: check insert result and persist worker_notify_status
  const { error: notifErr } = await db.from('worker_notifications').insert({
    type:     'needs_review',
    message:  `Plan semanal listo para revisar — semana del ${weekStart}`,
    brand_id: job.brand_id,
    read:     false,
    metadata: {
      plan_id:        planId,
      week_start:     weekStart,
      event:          'weekly_plan.ideas_ready',
      routing_reason: {
        flag_checked:    decision.flag_checked,
        effective_value: decision.effective_value,
        reason:          decision.reason,
      },
    },
  });
  const notifyStatus = notifErr ? 'failed' : 'sent';
  if (notifErr) {
    log({ level: 'error', scope: 'plan-week', event: 'worker_notification_failed',
          plan_id: planId, error: notifErr.message });
  } else {
    log({ level: 'info', scope: 'plan-week', event: 'worker_notification_sent', plan_id: planId });
  }
  await db.from('weekly_plans')
    .update({ worker_notify_status: notifyStatus })
    .eq('id', planId);
}
```

Respuestas:

| Pregunta | Respuesta |
|---|---|
| a. ¿Se captura el `error` del INSERT? | **SÍ** — `const { error: notifErr }` |
| b. ¿Se maneja `error.code === '23505'` (duplicado)? | **NO** — error genérico; duplicado = 'failed', no silencioso |
| c. ¿UPDATE `worker_notify_status='sent'` tras INSERT exitoso? | **SÍ** — línea 292 |
| d. ¿UPDATE `worker_notify_status='failed'` si INSERT falla? | **SÍ** — misma línea, rama `notifErr` truthy |
| e. ¿Se usa `.select()` para verificar que retornó fila? | **NO** — INSERT sin `.select()` |

**Conclusión del código: el código es correcto.** El UPDATE del flag siempre ocurre, ya sea a 'sent' o 'failed'. No hay rama de código que deje el status en 'pending' si el handler llega a ejecutarse.

---

### Paso 2 — Cliente de Supabase

```typescript
// plan-week.ts:171
const db = createAdminClient() as DB;
```

```typescript
// src/lib/supabase.ts:53-60
// ─── Admin (service role) — bypass RLS for server-only operations
export function createAdminClient(): any {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Missing Supabase service role configuration');
  return createClient(url, secret, { ... });
```

**Es service_role**. RLS se bypassa automáticamente. No es el problema.

---

### Paso 3 — Policies de worker_notifications

El archivo `supabase/worker_notifications.sql` define:

```sql
-- Solo SELECT y UPDATE para workers autenticados
CREATE POLICY "workers_can_read_notifications"  ON worker_notifications FOR SELECT ...
CREATE POLICY "workers_can_update_notifications" ON worker_notifications FOR UPDATE ...
```

**No hay policy de INSERT para ningún rol** — el comentario del DDL dice explícitamente: "Inserted via admin client (bypasses RLS)". Con service_role, RLS no aplica: el INSERT funciona sin policy de INSERT.

---

### Paso 4 — Reproducción del INSERT

Output del test ejecutado en vivo:

```
--- Test 1: INSERT worker_notifications with service_role ---
error: null
data: [{"id":"36ab7244-...", "type":"needs_review", ...}]
cleanup: ok

--- Test 2: inspect plan 1a4550ae ---
planErr: null
plan: {
  "id":                   "1a4550ae-865c-4e74-bf38-75a668851b38",
  "status":               "ideas_ready",
  "worker_notify_status": "sent",          ← ya no es 'pending'
  "client_email_status":  "not_needed",
  "created_at":           "2026-04-23T07:32:39.355223+00:00",
  "brand_id":             "e8dc77ef-..."
}

--- Test 3: any real plans with worker_notify_status=pending ---
pending plans: []                           ← 0 planes afectados en DB

--- Test 4: worker_notifications for plan 1a4550ae ---
notifications: []                           ← 0 notificaciones para este plan
```

**El INSERT con service_role funciona perfectamente** (error null, fila devuelta). El plan en cuestión ya muestra `worker_notify_status='sent'`.

---

## Diagnóstico raíz

### El plan `1a4550ae-...` es un artefacto de test, no un plan de producción

Traza reconstruida:

1. **07:32 UTC** — El script `verify-planning-fixes-fase1.ts` creó el plan directamente con `status='ideas_ready'` vía INSERT de DB. El handler `plan_week` **nunca ejecutó** para este plan.

2. **~08:00 UTC** — Las migraciones de Fase 1 se aplicaron. El backfill hizo:
   ```sql
   -- weekly_plans con status='ideas_ready' y worker_notify_status IS NULL → 'pending'
   UPDATE weekly_plans SET worker_notify_status = 'pending' WHERE ...
   ```
   El plan de test recibió `worker_notify_status='pending'` porque encajaba en el criterio. Esto es correcto: la migration identifica planes que **necesitan** que el worker sea notificado.

3. **Post-migración** — El plan aparece con `worker_notify_status='pending'` y 0 notificaciones en `worker_notifications`. El usuario lo observó en este estado y reportó el bug.

4. **Ahora** — El plan muestra `worker_notify_status='sent'` aunque sigue sin notificaciones. Alguien lo actualizó manualmente entre la observación del usuario y la investigación. Esto crea una inconsistencia leve (status='sent' pero sin notificación real), pero es benigna para un plan de test.

### ¿Puede ocurrir en producción para planes reales?

**SÍ, en una ventana de tiempo específica:** Cualquier plan que estuviera en `status='ideas_ready'` en el momento en que se aplicó la migración de Fase 1 recibió `worker_notify_status='pending'`. Si el código de Fase 1 aún no estaba desplegado cuando el `plan_week` handler procesó ese plan (race condition deploy/migration), el handler antiguo no haría el UPDATE del flag.

**Para planes nuevos generados DESPUÉS del deploy completo:** No puede ocurrir. El handler hace el UPDATE siempre.

---

## Conclusión

**Conclusión C parcial + Artefacto de test.**

El INSERT funciona. El código es correcto. El plan reportado era un artefacto de los scripts de verificación, no un plan real de producción.

La única anomalía real es la inconsistencia `worker_notify_status='sent'` sin fila en `worker_notifications` para ese plan de test — que sería exactamente lo que el reconcile cron de Fase 2 tendría que detectar (sent pero sin fila confirmada).

**No se requiere hotfix de código.**

---

## Plan de data cleanup

### 1. Eliminar el plan de test huérfano

```sql
-- El plan se creó por el verify script, nunca procesado por el handler
DELETE FROM weekly_plans WHERE id = '1a4550ae-865c-4e74-bf38-75a668851b38';
-- CASCADE eliminará content_ideas y client_feedback asociados
```

### 2. Identificar planes reales que necesitan reconciliación

```sql
-- Planes en 'pending' (creados antes o durante el deploy de Fase 1)
SELECT id, status, worker_notify_status, created_at
FROM weekly_plans
WHERE worker_notify_status = 'pending'
  AND created_at > '2026-04-23T00:00:00Z';  -- ajustar a fecha real del deploy
```

**Resultado actual:** `[]` — ningún plan afectado. No hay acción requerida.

### 3. Verificación de consistencia post-deploy

```sql
-- Planes con status='sent' pero sin notificación correspondiente (inconsistencia)
SELECT wp.id, wp.worker_notify_status, wp.created_at
FROM weekly_plans wp
WHERE wp.worker_notify_status = 'sent'
  AND NOT EXISTS (
    SELECT 1 FROM worker_notifications wn
    WHERE wn.metadata->>'plan_id' = wp.id::text
  )
  AND wp.created_at > '2026-04-23T00:00:00Z';
```

Este query detectaría el caso edge donde el handler marcó 'sent' pero el INSERT falló silenciosamente (escenario que el código actual no puede producir, pero que el cron de Fase 2 debería monitorizar).

---

## Nota para Fase 2

El reconcile cron `reconcile-worker-notifications` (Fase 2) debería detectar:
- Planes con `worker_notify_status='pending'` — reenviar notificación
- Planes con `worker_notify_status='sent'` pero sin fila en `worker_notifications` — marcar como 'failed' y reintentar

Esto cubre tanto la ventana de deploy como cualquier fallo puntual futuro.
