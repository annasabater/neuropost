# Scheduler zombi — diagnóstico 2026-04-22

**Brand afectado:** `e8dc77ef-8371-4765-a90c-c7108733f791`
**Síntoma:** 60–76 jobs `content:generate_image` con `requested_by='system'` por hora, 24h seguidas, todos fallando con "Replicate insufficient credit".
**Estado:** NO aplicado. Sólo diagnóstico y propuesta de pause.
**Referencia previa:** [docs/audit-flow-cliente-worker-2026-04-21.md](audit-flow-cliente-worker-2026-04-21.md).

---

## TL;DR — el loop principal

El bucle zombi está en **[runner.ts:332-370](../src/lib/agents/runner.ts#L332-L370)** ("Stuck post recovery"), que corre dentro de `runOnce()` llamado por el cron `/api/cron/agent-queue-runner` **cada minuto**:

1. Busca posts en `status='request'` con `created_at < now-15min`, limit 5.
2. Para cada uno, comprueba si existe un job activo (`status IN ['pending','running','claimed']`).
3. Si no hay → inserta un `content:generate_image` con `requested_by:'system'`.

El filtro de "job activo" **no contempla `status='error'`**. Cuando el job agota los 3 reintentos por "insufficient credit", queda en `error`, pero el post sigue en `request`. En la siguiente tick el check vuelve a pasar y se crea otro job. Infinito.

- Cadencia observada 60-76/h = 1-2 posts atascados × 60 ticks/h (+ nudge residual del drain cada 5 min).
- Se autoamplifica: cada fallo deja el post exactamente igual que antes → vuelve a disparar.
- El brand nunca debería llegar a generate_image porque está en `publish_mode='semi'`, pero aquí ya no hay gate — la recuperación inserta directamente en `agent_jobs`, saltándose `queueJob()` y `plan-gate.ts`.

---

## 1. ¿Quién escribe `requested_by='system'`?

Cinco matches literales. Sólo uno dispara `generate_image` sin intervención humana:

| # | Archivo:línea | Función / endpoint | Acción que crea | 🔴 auto? |
|---|---|---|---|---|
| 1 | [runner.ts:364](../src/lib/agents/runner.ts#L364) | `runOnce()` → bloque "stuck post recovery" | **`content:generate_image`** | 🔴 **sí, cada minuto** |
| 2 | [onboarding-content.ts:61](../src/lib/onboarding-content.ts#L61) | `triggerOnboardingContent()` | `strategy:build_taxonomy` | no — idempotente (flag `onboarding_content_triggered`) |
| 3 | [onboarding-content.ts:72](../src/lib/onboarding-content.ts#L72) | idem | `strategy:generate_ideas` | no — idempotente |
| 4 | [onboarding-content.ts:92](../src/lib/onboarding-content.ts#L92) | idem | `content:generate_image` (demo) | no — idempotente, 1 sola vez por brand |
| 5 | [brands/route.ts:156](../src/app/api/brands/route.ts#L156) | `PATCH /api/brands` cuando cambia location | `scheduling:detect_holidays` | no — sólo al editar location |

**Conclusión:** `runner.ts:364` es el único emisor que puede repetir sin intervención humana. El resto son one-shot.

---

## 2. Orígenes de `generate_image`

Agrupados por si pueden auto-amplificarse:

| Origen | Archivo:línea | Disparador | Auto? |
|---|---|---|---|
| Stuck-post recovery | [runner.ts:360](../src/lib/agents/runner.ts#L360) | cron `/api/cron/agent-queue-runner` cada minuto, sobre posts huérfanos | 🔴 **sí, el sospechoso principal** |
| plan_week fan-out | [strategy/plan-week.ts:81](../src/lib/agents/strategy/plan-week.ts#L81) | sub-jobs de `strategy:plan_week` | 🔴 sí, 1 vez/semana por brand (monday-brain) |
| weekly pipeline steps | [pipelines/weekly.ts:51](../src/lib/agents/pipelines/weekly.ts#L51) | encola `plan_week` que luego produce los `generate_image` | 🔴 cascada, semanal |
| intents (autopilot) | [intents.ts:53,71,80](../src/lib/agents/intents.ts#L53) | `intent:create_post` y variantes | sí, disparado desde autopilot |
| Validator re-queue | [handlers/validator.ts:297](../src/lib/agents/handlers/validator.ts#L297) | cuando `validate_image` rechaza, reemite con prompt corregido | 🔴 sí, pero tiene contador `attempt_number` y escala a review humana |
| onboarding demo | [onboarding-content.ts:80](../src/lib/onboarding-content.ts#L80) | conexión IG o subida de media | no — flag `onboarding_content_triggered` |
| recurring-posts cron | [cron/recurring-posts/route.ts:119](../src/app/api/cron/recurring-posts/route.ts#L119) | cron horario sobre `recurring_posts.active=true` | sí, limitado por `next_scheduled_at` |
| seasonal-planner cron | [cron/seasonal-planner/route.ts:79](../src/app/api/cron/seasonal-planner/route.ts#L79) | cron mensual sobre `seasonal_dates` | no — valida post existente antes |
| POST /api/posts | [api/posts/route.ts:369,391](../src/app/api/posts/route.ts#L369) | cliente crea post | no — user-triggered |
| POST /api/posts/[id]/generate-image | [api/posts/[id]/generate-image/route.ts:94](../src/app/api/posts/%5Bid%5D/generate-image/route.ts#L94) | cliente pide fotos extra | no — user-triggered |
| worker regenerate | [api/worker/posts/[id]/regenerate/route.ts:95](../src/app/api/worker/posts/%5Bid%5D/regenerate/route.ts#L95) | worker pulsa "regenerar" | no — worker-triggered |
| weekly-plan confirm | [api/client/weekly-plans/[id]/confirm/route.ts:71](../src/app/api/client/weekly-plans/%5Bid%5D/confirm/route.ts#L71) | cliente aprueba plan | no — user-triggered |

🔴 = puede disparar sin humano, al menos en teoría. El único de esos que casa con cadencia horaria es **runner.ts:360**.

---

## 3. Inventario completo de crons

### `vercel.json` — 25 entradas

| Path | Schedule | Frecuencia/h | Puede crear `generate_image`? |
|---|---|---|---|
| `/api/cron/agent-queue-runner` | `* * * * *` | 60 | 🔴 **sí, vía `runOnce()` stuck-post recovery** |
| `/api/cron/drain-agent-jobs` | `*/5 * * * *` | 12 | sólo drena, no crea generate_image ([ver §3.b](#3b-drain-agent-jobs-no-recicla-posts)) |
| `/api/cron/process-agent-replies` | `* * * * *` | 60 | no (procesa respuestas) |
| `/api/cron/health-check` | `*/15 * * * *` | 4 | no |
| `/api/cron/publish-scheduled` | `0 * * * *` | 1 | no (publica, no genera) |
| `/api/cron/sync-comments` | `0 * * * *` | 1 | no |
| `/api/cron/refresh-tokens` | `0 */6 * * *` | 0.17 | no |
| `/api/cron/weekly-report` | `0 9 * * 1` | —  | no |
| `/api/cron/seasonal-planner` | `0 8 1 * *` | 1ª del mes | sí, pero con check de post existente ([seasonal-planner/route.ts:37-42](../src/app/api/cron/seasonal-planner/route.ts#L37-L42)) |
| `/api/cron/global-trends` | `0 23 * * 0` | domingo | no |
| `/api/cron/monday-brain` | `0 0 * * 1` | lunes 00:00 | 🔴 encola `weekly_pipeline` → `plan_week` → N × `generate_image` (1 vez/semana) |
| `/api/cron/churn-proactive` | `0 9 * * *` | diario | no |
| `/api/cron/detect-holidays` | `0 6 1 * *` | 1ª del mes | no (detecta fechas, no imágenes) |
| `/api/cron/analyze-inspirations` | `0 * * * *` | 1 | no |
| `/api/cron/recurring-posts` | `0 * * * *` | 1 | 🔴 sí, si hay `recurring_posts.active` con `next_scheduled_at<=now` |
| `/api/cron/monthly-report` | `0 10 1 * *` | mensual | no |
| `/api/inspiration/ingest` | `* * * * *` | 60 | no |
| `/api/cron/comment-pending-reminder` | `15 * * * *` | 1 | no |
| `/api/cron/reactivation-campaign` | `0 10 * * *` | diario | no |
| `/api/cron/reminders-campaign` | `0 11 * * *` | diario | no (ver abajo — el reminders-handler *sí* puede crear generate_image, ver §4) |
| `/api/cron/email-queue-processor` | `*/10 * * * *` | 6 | no |
| `/api/cron/reconcile-predictions` | `*/10 * * * *` | 6 | no |
| `/api/cron/flush-notifications` | `* * * * *` | 60 | no |
| `/api/cron/plan-reminders` | `0 12,20 * * *` | 2/día | no |

### 3.b. `drain-agent-jobs` no recicla posts

[cron/drain-agent-jobs/route.ts](../src/app/api/cron/drain-agent-jobs/route.ts) NO llama a `runOnce()`; sólo toma pending/running huérfanos y ejecuta el handler directamente. No dispara "stuck post recovery". Bueno — un ring menos de auto-amplificación.

### 3.c. pg_cron (Supabase)

Único match en [supabase/weekly_usage_and_regen.sql:77](../supabase/weekly_usage_and_regen.sql#L77): `reset-weekly-counters` los lunes 00:00 UTC. Sólo hace `UPDATE brands SET posts_this_week=0`. No crea agent_jobs.

### 3.d. `setInterval` / BullMQ repeat

Grep en `src/`:
- [ratelimit.ts:29](../src/lib/ratelimit.ts#L29) → limpieza in-memory, no crea jobs
- [WorkerTopTabs.tsx:48](../src/components/worker/WorkerTopTabs.tsx#L48) → poll UI cliente
- [settings/plan/page.tsx:222](../src/app/(dashboard)/settings/plan/page.tsx#L222) → poll UI cliente
- [AiThinking.tsx:18](../src/components/ui/AiThinking.tsx#L18) → animación

No hay `BullMQ repeat` ni job recurrente en Redis. Toda la recurrencia vive en vercel.json + la lógica de `runOnce()`.

---

## 4. Cadena `monday-brain → plan_week → generate_image`

Confirmada leyendo código, no runtime:

```
[cron] monday-brain  (lunes 00:00 UTC)
   └─ para cada brand activo:
        queueWeeklyPipeline(brandId)           pipelines/weekly.ts:67
        ├─ anchor: strategy:intent:weekly_pipeline   (marcado 'done' al crearse)
        └─ encola 6 steps con offsets 0,2,4,6,8,12 min:
            1. analytics:sync_post_metrics          (offset 0)
            2. analytics:recompute_weights          (offset 2)
            3. analytics:scan_trends                (offset 4)
            4. strategy:build_taxonomy              (offset 6)
            5. strategy:plan_week   { count: 5 }    (offset 8)   ← clave
            6. scheduling:auto_schedule_week        (offset 12)

plan_week (strategy/plan-week.ts):
   └─ genera N ideas (por defecto planQuota.posts_per_week, fallback 2)
      NOTA: monday-brain pasa `count: 5` como override, ignorando el plan del brand.
   └─ para cada idea con priority != 'baja':
        ideaToSubJobs()  emite:
        - content:generate_caption
        - content:generate_image   (si format != video/reel)
```

**Volumen esperado legítimo para este brand:** 1 ejecución/semana × ≤5 ideas = ≤5 `generate_image`/semana. Nada que ver con 70/hora.

El `count: 5` override en [weekly.ts:51](../src/lib/agents/pipelines/weekly.ts#L51) sí es un bug separado (ignora el `postsPerWeek: 2` del brand), pero irrelevante para el sangrado actual.

### `reminders.ts:198` (contexto adicional)

[handlers/reminders.ts:198](../src/lib/agents/handlers/reminders.ts#L198) también puede emitir `generate_image`. No lo abrí en profundidad — ❓ requiere verificar en runtime si algún cron lo activa sobre este brand específicamente.

---

## 5. Retry logic — `runner.ts` + `queue.ts`

| Pregunta | Respuesta |
|---|---|
| `max_attempts` por defecto | **3** ([queue.ts:46](../src/lib/agents/queue.ts#L46), idem en `queueSubJobs` línea 106 y en recovery `runner.ts:325`) |
| Backoff | **ninguno**. [queue.ts:202-213 `releaseJobForRetry`](../src/lib/agents/queue.ts#L202-L213) hace `UPDATE status='pending', started_at=null` → vuelve elegible inmediatamente. BullMQ *sí* tiene su propio retry/backoff, pero cuando cae en Supabase-fallback ([runner.ts:239-246](../src/lib/agents/runner.ts#L239-L246)) no hay delay ninguno. |
| Distingue fatal vs transient? | **Sólo parcialmente.** `plan-week.ts:134` y el brief-path de `imageGenerateHandler` en [local.ts:270](../src/lib/agents/handlers/local.ts#L270) usan regex `/timeout\|rate.?limit\|overloaded\|503\|504\|ECONN.../`. El path normal de `imageGenerateHandler` (`runPlain` línea 275) **no** — cualquier error lanza excepción → runner lo trata como retry hasta max_attempts. "Replicate insufficient credit" → retry (malo), luego error final (bueno). |
| BullMQ + Supabase doble contador | [runner.ts:138-139](../src/lib/agents/runner.ts#L138-L139) re-lanza tras `releaseJobForRetry`/`finalizeJob` para que BullMQ registre el fallo. El atributo `attempts` en Supabase y el de BullMQ son independientes; no se corrompen, pero un mismo job puede reintentarse por dos caminos. |

**Bug confirmado:** ningún error fatal es detectado como tal en el path principal de `generate_image`. "insufficient credit", "invalid API key", "model_not_found" todos se reintentan tres veces antes de morir, y dan feedback al bucle de recovery.

---

## 6. Tabla resumen: origen → frecuencia → auto-amplificación

| Origen | Frecuencia base | Auto-amplificación | Sospechoso? |
|---|---|---|---|
| 🎯 `runner.ts:360` stuck-post recovery | 60/h (cron cada min, limit 5 posts) | **SÍ — mientras post siga en 'request' y el job muera en 'error'** | ✅ **causa raíz** |
| `validator.ts:297` re-emit | 1/attempt (hasta 3) | No — tiene contador en input | no |
| `plan-week.ts:81` fan-out | 5/semana/brand | No — disparo fijo desde monday-brain | no |
| `recurring-posts` cron | ≤1/h/template | No — avanza `next_scheduled_at` | ❓ verificar si hay recurring_posts activos en este brand |
| `seasonal-planner` | 1/mes, salta si existe post | No | no |
| `onboarding-content.ts:80` | 1 vez/brand | No — flag idempotente | no |
| `intents.ts` `create_post` | user/autopilot trigger | Depende de quién lo llame | ❓ verificar si autopilot activo |

---

## 7. Diagrama del bucle

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tick del cron agent-queue-runner (cada 60s) → runOnce()               │
└────────────────────────────────────────────────────────────────────────┘
         │
         ▼
   1. drena BullMQ / Supabase fallback: procesa jobs 'pending'
         │
         │    (aquí es donde se intenta generate_image; Replicate responde
         │     "insufficient credit"; handler lanza; runner hace
         │     releaseJobForRetry hasta attempts=3 → status='error')
         │
         ▼
   2. orphan recovery (running > 10min) ─ no relevante al loop
         │
         ▼
   3. STUCK POST RECOVERY  ← runner.ts:332-370
         │
         ├─ SELECT posts WHERE status='request' AND created_at<now-15min LIMIT 5
         │
         ├─ para cada post:
         │     SELECT agent_jobs WHERE input.contains({_post_id})
         │                       AND status IN ('pending','running','claimed')
         │     ── no filtra 'error' ──
         │
         ├─ si no hay job activo:
         │     INSERT agent_jobs {
         │        action='generate_image',
         │        requested_by='system',
         │        input._post_id, _auto_pipeline=true,
         │        priority=60, max_attempts=3(default via queueJob? — NO,
         │        el INSERT no pasa por queueJob, usa default de la columna)
         │     }
         │
         ▼
   Siguiente tick (+60s): nuevo job en 'pending' → intentado → falla →
   'error' otra vez → post sigue en 'request' → recovery vuelve a
   insertar otro job → … ∞
```

Rompen el bucle:
- Recargar créditos en Replicate (el job pasa, post → `pending_worker`, sale de `request`).
- Mover el post manualmente a `draft` / `cancelled` / `needs_human_review`.
- Parchear la condición de recovery.

---

## 8. Propuesta de pause mínimo (NO APLICADO)

Prioridad por ratio seguridad/eficacia. Cualquiera de los tres frena el sangrado; yo aplicaría el **(A)** primero y después **(C)**.

### (A) Excluir jobs `error` del check de recovery

Es la fix quirúrgica. Un post cuya última pipeline cayó ya no es candidato silencioso, debe ir a triage de worker.

```diff
--- a/neuropost/src/lib/agents/runner.ts
+++ b/neuropost/src/lib/agents/runner.ts
@@ -345,14 +345,17 @@ export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerRes
     if (stuckPosts?.length) {
       for (const post of stuckPosts as Array<{ id: string; brand_id: string }>) {
-        // Check if there's already a job for this post
-        const { data: existingJob } = await db
+        // Check if there's ANY job for this post (including 'error' — don't
+        // resurrect a pipeline that already failed N times).
+        const { data: anyJob } = await db
           .from('agent_jobs')
           .select('id')
           .contains('input', { _post_id: post.id })
-          .in('status', ['pending', 'running', 'claimed'])
+          .in('status', ['pending', 'running', 'claimed', 'error'])
           .maybeSingle();

-        if (!existingJob) {
+        if (!anyJob) {
+          // First-time recovery only. If a job exists in 'error' the post
+          // needs human triage, not another retry.
           await db.from('agent_jobs').insert({
             brand_id:     post.brand_id,
```

**Pro:** detiene el bucle instantáneamente.
**Con:** posts genuinamente rotos se quedan en `request` hasta que el worker los mueva → hay que tener UI de triage (ya existe `/worker/central`, según MEMORY).

### (B) Tratar "insufficient credit" como fatal, no transient

Impide que *todos* los `generate_image` consuman max_attempts cuando la cuenta Replicate está seca.

```diff
--- a/neuropost/src/lib/agents/handlers/local.ts
+++ b/neuropost/src/lib/agents/handlers/local.ts
@@ -274,13 +274,22 @@ const imageGenerateHandler: AgentHandler = async (job) => {
     }
   }

-  const result = await runPlain(
-    () => runImageGenerateAgent(input),
-    'image',
-    {
-      model: 'nanobanana-v2',
-      preview_url: (out) => out.imageUrl as string,
-    },
-  );
+  let result;
+  try {
+    result = await runPlain(
+      () => runImageGenerateAgent(input),
+      'image',
+      {
+        model: 'nanobanana-v2',
+        preview_url: (out) => out.imageUrl as string,
+      },
+    );
+  } catch (err) {
+    const msg = err instanceof Error ? err.message : String(err);
+    // Fatal — do not retry. Provider billing / auth / model-not-found errors.
+    if (/insufficient.?credit|payment.?required|invalid.?api.?key|model_not_found|402|401/i.test(msg)) {
+      return { type: 'fail', error: msg };
+    }
+    throw err;
+  }
```

**Pro:** ahorra 2/3 de los intentos wasted.
**Con:** no detiene el bucle — sólo reduce el ratio (de 3 intentos a 1 por fallo). Complementa (A), no la sustituye.

### (C) Circuit breaker a nivel brand

Si los últimos 10 jobs de `content:generate_image` del brand han sido `error`, no crear más.

```diff
--- a/neuropost/src/lib/agents/runner.ts
+++ b/neuropost/src/lib/agents/runner.ts
@@ -345,6 +345,20 @@ export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerRes
     if (stuckPosts?.length) {
       for (const post of stuckPosts as Array<{ id: string; brand_id: string }>) {
+        // Circuit breaker: if the last 10 generate_image jobs for this brand
+        // all errored, stop auto-recovery for this brand until a human resets it.
+        const { data: last10 } = await db
+          .from('agent_jobs')
+          .select('status')
+          .eq('brand_id', post.brand_id)
+          .eq('action', 'generate_image')
+          .order('created_at', { ascending: false })
+          .limit(10);
+        const errors = (last10 ?? []).filter((r: { status: string }) => r.status === 'error').length;
+        if (errors >= 10) {
+          console.warn(`[runner] Circuit breaker open for brand ${post.brand_id} — skipping recovery`);
+          continue;
+        }
+
         // ... existing logic
```

**Pro:** defensa en profundidad; protege frente a otros orígenes futuros.
**Con:** no soluciona la causa raíz, sólo acota el daño. Útil como safety net permanente.

### (D) Toggle de kill-switch por env (sin deploy)

Para el caso "necesito parar esto AHORA":

```diff
--- a/neuropost/src/lib/agents/runner.ts
+++ b/neuropost/src/lib/agents/runner.ts
@@ -331,6 +331,11 @@ export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerRes
   // ── Stuck post recovery ...
+  if (process.env.DISABLE_STUCK_POST_RECOVERY === '1') {
+    return { ... };
+  }
   try {
```

Luego en Vercel: `vercel env add DISABLE_STUCK_POST_RECOVERY 1` y redeploy/promote. **Opción nuclear, sin lógica nueva**; el brand seguirá atascado pero no sangra más.

### (E) Desactivar el cron entero (último recurso)

En `vercel.json`, comentar la línea `agent-queue-runner`. **NO recomendado**: rompe *todos* los agentes del sistema, no sólo este brand. Mejor (A)+(C).

---

## 9. Cosas que NO pude confirmar sólo con código

❓ **Si el brand `e8dc77ef-...` tiene recurring_posts activos o autopilot habilitado.** Habría que leer `brands`, `recurring_posts`, `autopilot_*` para descartar contribuciones menores.
❓ **Reminders handler (`handlers/reminders.ts:198`).** Emite `generate_image`; no tracé qué lo activa para este brand.
❓ **Si `max_attempts` es 3 en la fila real.** En `runner.ts:357-365` el INSERT de recovery NO pasa por `queueJob()` y no especifica `max_attempts` — depende del default de la columna en la tabla `agent_jobs`. Si fuera NULL y la comparación `attempts < max_attempts` devolviera siempre false, los reintentos podrían ser distintos de 3. Requiere verificar en Supabase.
❓ **Quién pone posts en `status='request'` en primer lugar para este brand.** `/api/posts/new` ([posts/new/page.tsx:164](../src/app/(dashboard)/posts/new/page.tsx#L164)) lo hace, pero si hay flujos adicionales (p.ej. `plan_week` en *new flow* que también crea posts directos) habría que verificarlo.
❓ **Cuántos posts simultáneos están realmente atascados.** 60-76 jobs/h con límite de 5 posts/tick = compatible con 1 a 5 posts. Query rápida: `SELECT id, created_at FROM posts WHERE brand_id='...' AND status='request' ORDER BY created_at` en Supabase.

---

## 10. Acción recomendada inmediata

1. **(A)** como hotfix — 6 líneas, riesgo bajo, aplica a todos los brands.
2. Después, query manual para ver qué posts del brand están en `request` y decidir (draft / cancelled / enviar a worker review).
3. **(C)** como defensa permanente en PR separado.
4. **(B)** opcional, para ahorrar coste residual.

Todo pendiente de tu revisión — este documento no aplica ningún cambio.
