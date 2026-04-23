# Planning Fase 3 — Investigación Previa

> **Fecha:** 2026-04-23  
> **Alcance:** P6, P7, P8, P9, P10, P15, P20  
> **Metodología:** Lectura directa de código + queries contra DB real (service_role).  
> **Estado de Fases previas:** Confirmado en DB — todas las migraciones de Fase 1+2 aplicadas.

---

## Contradicciones entre docs previos y código real

| Doc | Afirmación | Realidad |
|---|---|---|
| `audit-planning-pipeline.md §3d` | El render endpoint "no tiene idempotencia" (P8) | **Corregido en Fase 1** — líneas 131-146 de `render/story/route.ts` ya tienen claim atómico. ✅ |
| `audit §3b` | INSERT worker_notifications sin check de error (P2) | **Corregido en Fase 1** — `plan-week.ts:271-297` ya captura `notifErr` y hace UPDATE del flag. ✅ |
| `audit §Sección 8 Q1` | `client_feedback` podría no existir como tabla | **Creada en Fase 1** — migración `20260423_planning_fixes_fase1_client_feedback.sql` aplicada y confirmada en DB. ✅ |
| `audit §P15` | Sin unique index en worker_notifications | **Creado en Fase 1** — `uq_worker_notifications_plan_type` confirmado con test real (23505 en duplicado). ✅ |
| `assumptions.md §Q8` | No existe cron de expiración de planes | **Creado en Fase 2** — `detect-stuck-plans` expira en 3 casos. ✅ |

---

## Paso 2 — createWeeklyPlanFromOutput (P6)

### 2a. Bloque completo con números de línea reales

**Archivo:** `src/lib/planning/weekly-plan-service.ts:71-172`

```typescript
// ─── Idempotency check ───────────────────────────── :77-97
const { data: existing } = await db
  .from('weekly_plans').select('*')
  .eq('brand_id', params.brand_id)
  .eq('week_start', params.week_start)
  .maybeSingle();

if (existing) {
  // fetch associated ideas; return { plan: existing, created: false }
}

// ─── INSERT weekly_plan ──────────────────────────── :114-130
const { data: plan, error: planErr } = await db
  .from('weekly_plans')
  .insert({
    brand_id:        params.brand_id,
    parent_job_id:   params.parent_job_id,
    week_start:      params.week_start,
    status:          'generating',
    auto_approved:   false,
    auto_approved_at: null,
  })
  .select().single();

if (planErr || !plan) {
  throw new Error(`[weekly-plan-service] Failed to insert weekly_plan: ${planErr?.message}`);
}

// ─── INSERT content_ideas (posts) ───────────────── :133-157
const rows = parsedIdeas.map((idea) => ({ ... }));
const { error: ideasErr } = await db.from('content_ideas').insert(rows);

if (ideasErr) {
  // Manual rollback: delete the plan so the caller can retry
  await db.from('weekly_plans').delete().eq('id', plan.id);   // ← LINE 155
  throw new Error(`[weekly-plan-service] Failed to insert content_ideas: ${ideasErr.message}`);
}
```

### 2b. ¿Qué hace si falla el INSERT de weekly_plans?

Línea 128-130: `throw new Error(...)`. El error se propaga al caller (`plan-week.ts:157`) donde está envuelto en un `try/catch` que devuelve `{ type: 'fail' }`. **No hay plan huérfano en este caso.**

### 2c. ¿Qué hace si falla el INSERT de content_ideas?

Línea 153-157: ejecuta `DELETE weekly_plans WHERE id = plan.id` (manual rollback), luego `throw`. 

**El DELETE no tiene manejo de error.** Si falla:
- No se captura ni se loguea.
- El `throw` de línea 156 igual se propaga — el caller ve el error.
- El plan recién insertado (status='generating') queda **huérfano** en DB sin ideas.
- El cron `detect-stuck-plans` lo expirará a los 10 min (Caso A).

### 2d. El rollback manual

Es un `DELETE` separado en línea 155 sin `RETURNING` ni comprobación de error. Si el DELETE falla (deadlock, conexión caída), el plan huérfano se acumula silenciosamente. La única salvaguarda es `detect-stuck-plans` que lo expira.

**No hay transacción BEGIN/COMMIT.** La ventana de inconsistencia entre el INSERT de `weekly_plans` y el INSERT de `content_ideas` es de ~50-100ms normalmente. En ese gap, un segundo worker que procese el mismo job pasaría el `maybeSingle()` check y también insertaría (race condition de P6).

### 2e. Campos insertados

#### weekly_plans (INSERT en línea 117-125)

| Campo | Valor en INSERT | Tipo real en schema |
|---|---|---|
| `brand_id` | `params.brand_id` | `uuid NOT NULL FK brands(id)` |
| `parent_job_id` | `params.parent_job_id` | `uuid nullable FK agent_jobs(id)` |
| `week_start` | `params.week_start` | `date NOT NULL` |
| `status` | `'generating'` | `text CHECK(enum)` |
| `auto_approved` | `false` | `boolean DEFAULT false` |
| `auto_approved_at` | `null` | `timestamptz nullable` |

> ⚠️ **Sin `UNIQUE(brand_id, week_start)`** — confirmado en todas las migraciones revisadas. La idempotencia es solo por código (`maybeSingle()`), no por constraint de DB.

#### content_ideas — posts (INSERT en línea 134-149)

| Campo | Valor |
|---|---|
| `week_id` | `plan.id` |
| `brand_id` | `params.brand_id` |
| `agent_output_id` | `params.agent_output_id` |
| `category_id` | `idea.category_id` |
| `position` | `idea.position` |
| `day_of_week` | `idea.day_of_week` |
| `format` | `idea.format` |
| `angle` | `idea.angle` |
| `hook` | `idea.hook` |
| `copy_draft` | `idea.copy_draft` |
| `hashtags` | `idea.hashtags` |
| `suggested_asset_url` | `idea.suggested_asset_url` |
| `suggested_asset_id` | `idea.suggested_asset_id` |
| `status` | `'pending'` |

#### content_ideas — stories (INSERT en `plan-week.ts:~218`, separado)

Los campos adicionales relevantes que añade el handler directamente:
`content_kind='story'`, `story_type`, `template_id`, `render_status='pending_render'` (se setea en línea siguiente al INSERT).

### 2f. RPCs de Postgres relacionadas con weekly_plans / content_ideas

**Resultado de búsqueda en `supabase/migrations/**/*.sql`:** No se encontró ninguna `CREATE FUNCTION` que toque estas tablas.

La única función relevante del sistema es `claim_agent_jobs(p_limit)` (en `supabase/agent_jobs.sql`) que usa `FOR UPDATE SKIP LOCKED`, pero no toca `weekly_plans` ni `content_ideas`.

**Conclusión:** No hay ninguna RPC base — Fase 3 tendrá que crear una nueva función Postgres desde cero.

---

## Paso 3 — transitionWeeklyPlanStatus (P7, P20)

### 3a. Código completo

**Archivo:** `src/lib/planning/weekly-plan-service.ts:178-222`

```typescript
export async function transitionWeeklyPlanStatus(params: {
  plan_id: string;
  to:      WeeklyPlanStatus;
  reason?: string;
}): Promise<WeeklyPlan> {
  const db = createAdminClient() as DB;

  // Load current status                                    ← LÍNEAS 185-194
  const { data: current, error } = await db
    .from('weekly_plans').select('*')
    .eq('id', params.plan_id).single();

  if (error || !current) {
    throw new Error(`[weekly-plan-service] Plan not found: ${params.plan_id}`);
  }

  assertValidTransition(current.status, params.to);         ← LÍNEA 196

  // Extra timestamps for specific transitions             ← LÍNEAS 199-202
  const extra: Record<string, unknown> = {};
  if (params.to === 'sent_to_client')  extra.sent_to_client_at  = ...;
  if (params.to === 'client_approved') extra.client_approved_at = ...;
  if (params.to === 'auto_approved')   { extra.auto_approved = true; ... }

  const { data: updated, error: updateErr } = await db     ← LÍNEAS 204-209
    .from('weekly_plans')
    .update({ status: params.to, ...extra })
    .eq('id', params.plan_id)
    // ← NO HAY: .eq('status', current.status)
    .select().single();

  if (updateErr || !updated) {
    throw new Error(`Status transition failed: ${updateErr?.message}`);
  }

  console.log(`[...] ${params.plan_id}: ${current.status} → ${params.to}`);
  return updated as WeeklyPlan;
}
```

### 3b. Todas las transiciones válidas (`assertValidTransition`)

| Estado origen | Estados destino permitidos |
|---|---|
| `generating` | `ideas_ready`, `expired` |
| `ideas_ready` | `sent_to_client`, `client_reviewing`, `expired`, `skipped_by_client` |
| `sent_to_client` | `client_reviewing`, `auto_approved`, `expired` |
| `client_reviewing` | `client_approved`, `auto_approved`, `skipped_by_client`, `expired` |
| `client_approved` | `producing` |
| `producing` | `calendar_ready` |
| `calendar_ready` | `completed` |
| `auto_approved` | `producing` |
| `skipped_by_client` | `expired` |
| `completed` | *(terminal — ninguno)* |
| `expired` | *(terminal — ninguno)* |

### 3c. ¿El UPDATE incluye `WHERE status = $old`?

**No.** El UPDATE en líneas 204-209 solo tiene `.eq('id', params.plan_id)`. No hay `.eq('status', current.status)`.

La validación de `assertValidTransition` ocurre en línea 196, pero entre esa validación y el UPDATE de línea 204 no hay lock. Otra llamada concurrente puede cambiar el estado en ese gap, y el UPDATE sobreescribirá el estado más nuevo.

### 3d. Todos los callers de `transitionWeeklyPlanStatus`

| Archivo | Línea | Transición | Notas |
|---|---|---|---|
| `plan-week.ts` | 168 | `generating → ideas_ready` | Inmediatamente tras crear plan |
| `plan-week.ts` | 300 | `ideas_ready → client_reviewing` | Rama "cliente directo" |
| `approve/route.ts` | 25 | `ideas_ready → client_reviewing` | Worker aprueba plan |
| `reject/route.ts` | 32 | `? → expired` | Worker rechaza; estado origen variable |
| `confirm/route.ts` | 47 | `client_reviewing → client_approved` | Cliente confirma |
| `confirm/route.ts` | 85 | `client_approved → producing` | Tras encolar jobs de producción |
| `skip-week/route.ts` | 31 | `? → skipped_by_client` | Cliente salta semana |
| `proposal-hooks.ts` | 77 | `producing → calendar_ready` | Cuando todas las ideas están producidas |

### 3e. UPDATEs directos a `weekly_plans.status` que BYPASAN la función

Dos casos en `detect-stuck-plans/route.ts`:

```typescript
// Línea 39 — Case A: stuck in 'generating' > 10 min
.from('weekly_plans')
.update({ status: 'expired', skip_reason: 'stuck_in_generating_over_10_minutes' })
.eq('status', 'generating')
.lt('created_at', tenMinutesAgo)

// Línea 67 — Case C: abandoned > 7 days
.from('weekly_plans')
.update({ status: 'expired', skip_reason: 'abandoned_over_7_days' })
.in('status', ['ideas_ready', 'client_reviewing'])
.lt('created_at', sevenDaysAgo)
```

Ambos bypasan `transitionWeeklyPlanStatus` intencionalmente (cron de emergencia). Incluyen `WHERE status = ...` propio, por lo que son seguros desde el punto de vista de over-write. **No llaman `assertValidTransition`** — si se añadieran nuevos estados intermedios al state machine, estos crons seguirían funcionando sin actualización.

Otros UPDATEs directos (no de status):
- `reject/route.ts:23` — `UPDATE weekly_plans SET skip_reason=...` (metadata, no estado)
- `confirm/route.ts:48` — `UPDATE weekly_plans SET client_approved_at=...`
- `skip-week/route.ts:30` — `UPDATE weekly_plans SET skip_reason=...`
- `ideas/[ideaId]/route.ts:110` — `UPDATE weekly_plans SET client_first_action_at=...`
- `plan-week.ts:297` — `UPDATE weekly_plans SET worker_notify_status=...`
- `trigger-client-email.ts:111,205` — `UPDATE weekly_plans SET client_email_status=...`

---

## Paso 4 — Estado de templates (P9, P10)

### 4a. Queries ejecutadas contra DB real

```
total distinct template_ids in content_ideas: 5
orphan template_ids: []
orphan_ideas count: 0

system templates: 10 [
  'Quote Clásica', 'Quote Minimal', 'Horario Semanal', 'Horario Destacado',
  'Promo Banner', 'Promo Urgente', 'Dato Destacado', 'Lema de Marca',
  'Foto con Overlay', 'Contenido Libre'
]
custom templates: 0
```

**FK constraint check:** La migración `20260420_sprint10_content_ideas_columns.sql` añadió `template_id uuid` **sin `REFERENCES public.story_templates(id)`** — confirmado leyendo el SQL. No existe ninguna FK constraint en `content_ideas(template_id)`.

**Conclusión:** La migración de P9 es SEGURA — 0 orphans hoy. Si se añade `FOREIGN KEY template_id REFERENCES story_templates(id) ON DELETE SET NULL`, no romperá ningún dato existente.

### 4b. Bloque `templatesEnabled` en `plan-week.ts`

**Archivo:** `src/lib/agents/strategy/plan-week.ts:181-189`

```typescript
let templatesEnabled: string[] =
  brand.content_mix_preferences?.stories_templates_enabled ?? [];
if (templatesEnabled.length === 0) {
  const { data: sysTpls } = await db
    .from('story_templates').select('id').eq('kind', 'system');
  templatesEnabled = (sysTpls ?? []).map((t: { id: string }) => t.id);
}
```

**Si `templatesEnabled.length === 0` DESPUÉS del fallback (tabla vacía):**
- `templatesEnabled = []` → `K = 0`
- En `plan-stories.ts` línea ~290: `template_id = K > 0 ? templatesEnabled[idx % K] ?? null : null`
- Todas las stories salen con `template_id = null`
- El render endpoint (`render/story/route.ts:126-128`): `if (!idea.template_id || !idea.brand_id) return 422`
- **Resultado:** Todas las stories fallan silenciosamente con 422 en render. El cliente ve "renderizando..." para siempre.

**Estado hoy:** 10 templates de sistema presentes. El problema solo se manifestaría si se borran todos.

---

## Paso 5 — Confirmación Fase 1 y Fase 2 intactas (P8, P15)

### 5a. Claim atómico en render endpoint (P8)

**Archivo:** `src/app/api/render/story/[idea_id]/route.ts:131-146`

```typescript
// P1: idempotency — already rendered, nothing to do
if (idea.render_status === 'rendered') {
  return NextResponse.json({ rendered_image_url: idea.rendered_image_url }, { status: 200 });
}

// P1: atomic claim — skip if another worker already claimed this render
const { data: claimed } = await db
  .from('content_ideas')
  .update({ render_status: 'rendering', render_started_at: new Date().toISOString() })
  .eq('id', idea_id)
  .in('render_status', ['pending_render', 'render_failed'])
  .select('id');

if (!claimed || claimed.length === 0) {
  return NextResponse.json({ error: 'Render already in progress' }, { status: 409 });
}
```

✅ **Claim atómico en lugar** — el doble-POST ahora devuelve 409 en vez de duplicar la llamada a Replicate.

### 5b. Unique index en worker_notifications (P15)

Test ejecutado contra DB real (insertar dos registros con mismo `plan_id` + `type`):

```
duplicate worker_notification insert 1: OK (inserted)
duplicate worker_notification insert 2: 23505
  ✅ unique index IS enforced
```

Índice confirmado: `uq_worker_notifications_plan_type ON worker_notifications ((metadata->>'plan_id'), type) WHERE metadata->>'plan_id' IS NOT NULL`

### 5c. Estado de todas las columnas de Fase 1

Verificado con queries reales:

| Comprobación | Resultado |
|---|---|
| `weekly_plans`: `worker_notify_status`, `client_email_status`, `client_email_attempts` | ✅ OK |
| `content_ideas`: `render_status`, `render_attempts`, `render_started_at`, `render_completed_at` | ✅ OK |
| `client_feedback` tabla | ✅ OK |
| `brands.use_new_planning_flow` columna | ✅ OK |

---

## Paso 6 — Uso concurrente real

### 6a. ¿El runner procesa jobs en paralelo?

**Archivo:** `src/lib/agents/runner.ts:188-198`

```typescript
const DEFAULT_BATCH_SIZE = 3;

export async function runOnce(batchSize = DEFAULT_BATCH_SIZE): Promise<RunnerResult> {
  const claimed = await claimJobs(batchSize);
  // Process sequentially to avoid hammering external APIs (Replicate rate limits)
  for (const job of claimed) {
    await processJob(job).catch(() => null);
  }
}
```

**Secuencial**, máximo 3 jobs por tick de cron. El comentario es explícito. El claim usa `FOR UPDATE SKIP LOCKED` (atómico).

**Implicación para P6/P20:** En una sola instancia del runner no puede haber race condition para el mismo brand (jobs procesados uno a uno). El riesgo existe si:
- Dos ticks del runner se solapan (cron cada minuto, job de plan_week puede tomar hasta 45s)
- O el runner se escala horizontalmente en el futuro

### 6b. Brands con `use_new_planning_flow=true`

```
brands use_new_planning_flow=true: 1 ['SportArea']
```

Solo 1 brand activo con el nuevo flow. El riesgo de race condition es teóricamente posible pero nunca se ha manifestado.

### 6c. Evidencia histórica de planes duplicados

Búsqueda en código y DB: **0 evidencias observables**. La tabla `weekly_plans` no tiene `UNIQUE(brand_id, week_start)`, pero en producción con 1 brand activo y runner secuencial, la probabilidad es baja. Los tests del script de verificación de Fase 1/2 podrían haber dejado planes de test (ya limpios).

---

## Paso 7 — Dependencias ocultas (archivos que tocan weekly_plans / content_ideas)

### Archivos con INSERT

| Archivo | Tabla | Tipo de operación |
|---|---|---|
| `src/lib/planning/weekly-plan-service.ts:115` | `weekly_plans` | INSERT (único) |
| `src/lib/planning/weekly-plan-service.ts:151` | `content_ideas` (posts) | INSERT |
| `src/lib/agents/strategy/plan-week.ts:~218` | `content_ideas` (stories) | INSERT directo |
| `src/lib/agents/strategy/regenerate-idea.ts` | `content_ideas` | INSERT (variaciones) |

> ⚠️ **El INSERT de stories en `plan-week.ts` es independiente de `createWeeklyPlanFromOutput`**. Si Fase 3 refactoriza `createWeeklyPlanFromOutput` en una RPC, las stories seguirán insertándose fuera de esa RPC. Decisión de diseño necesaria.

### Archivos con UPDATE (solo `weekly_plans.status`)

| Archivo | Línea | Qué actualiza |
|---|---|---|
| `weekly-plan-service.ts` | 204-209 | `status` vía `transitionWeeklyPlanStatus` |
| `cron/detect-stuck-plans/route.ts` | 39, 67 | `status='expired'` directo (bypass) |

### Archivos con UPDATE (campos no-status de weekly_plans)

`reject/route.ts`, `confirm/route.ts`, `skip-week/route.ts`, `ideas/[ideaId]/route.ts`, `plan-week.ts`, `trigger-client-email.ts`

### Archivos solo SELECT (no modifican)

`client/weekly-plans/route.ts`, `client/weekly-plans/[id]/route.ts`, `worker/weekly-plans/[id]/route.ts`, `worker/weekly-plans/pending/route.ts`, `worker/brands/*/pending-counts/route.ts`, `worker/metrics/route.ts`, `worker/validation-pending-counts/route.ts`, `local.ts` (handlers), `reminders.ts`

### Archivos que tocan content_ideas con UPDATE/DELETE

`render/story/route.ts`, `worker/weekly-plans/[id]/ideas/[ideaId]/route.ts`, `client/weekly-plans/[id]/ideas/[ideaId]/route.ts`, `proposal-hooks.ts`, `cron/reconcile-renders/route.ts` (UPDATE render_status/attempts)

---

## Paso 8 — Riesgos y bloqueadores

### 8a. ¿Puede fallar la migración de P9 (añadir FK en template_id)?

**No — datos: 0 orphans.** Todos los `template_id` en `content_ideas` apuntan a templates existentes.

**Decisión de diseño requerida:** `ON DELETE SET NULL` vs `ON DELETE RESTRICT`.
- `SET NULL` → si se borra un template, las ideas quedan con `template_id=null` → render 422. Comportamiento observable, no catastrófico.
- `RESTRICT` → impide borrar templates con ideas asociadas. Más seguro, pero exige soft-delete de templates.
- **Recomendación:** `ON DELETE SET NULL` — consistente con el comportamiento actual y da señal observable.

### 8b. ¿La RPC atómica de P6 cambia la signatura visible?

`createWeeklyPlanFromOutput` es la única función que llama a la RPC. Su resultado actual:
```typescript
interface CreateWeeklyPlanResult {
  plan:    WeeklyPlan;
  ideas:   ContentIdea[];
  created: boolean;
}
```
La RPC puede mantener exactamente esta signatura — internamente ejecuta BEGIN/COMMIT, externamente devuelve `{ plan_id, idea_ids }` que el servicio convierte al tipo existente.

**No hay cambio de API pública.** Los callers de `createWeeklyPlanFromOutput` (solo `plan-week.ts:157`) no necesitan modificarse.

**Complejidad añadida:** Las stories se insertan **fuera** de `createWeeklyPlanFromOutput` (en `plan-week.ts:~218`). La RPC solo cubriría posts. Si se quiere atomicidad completa (posts + stories), habría que expandir la RPC para aceptar también los `storyRows`, lo que requiere cambiar la signatura de la función.

### 8c. ¿Qué código depende del comportamiento viejo?

| Comportamiento viejo | Archivos afectados | Riesgo |
|---|---|---|
| Rollback manual (DELETE) al fallar content_ideas INSERT | `weekly-plan-service.ts:155` | Desaparece con RPC — el rollback lo hace Postgres automáticamente |
| UPDATE de status sin WHERE previo (`transitionWeeklyPlanStatus:206`) | Todos los callers de `transitionWeeklyPlanStatus` | El UPDATE atómico (`UPDATE ... WHERE status=$old RETURNING *`) cambia el comportamiento: si el estado ya cambió, lanza error en lugar de silenciosamente sobrescribir. **Los callers deberían manejar este nuevo error.** |
| `detect-stuck-plans` bypasa la función | `detect-stuck-plans/route.ts:39,67` | No se ve afectado por P20 (ya tiene propio WHERE) |

### 8d. ¿Hay features en progreso que colisionen con Fase 3?

**TODOs en código:** `grep -rn "TODO\|FIXME" src/lib/planning/ src/lib/agents/strategy/` → **0 resultados**.

**Branches recientes:** No hay evidencia de work-in-progress en estas tablas más allá de las fases actuales.

**Feature incompleta detectada:** `calendar_ready → completed` no tiene trigger automático (confirmado en `assumptions.md §Q6`). `proposal-hooks.ts` dispara `calendar_ready` vía `onProposalApproved`, pero nada dispara `completed`. **Esta es una feature abierta que no colisiona con Fase 3 pero debe documentarse.**

**Migración `20260430_sprint12_brand_material_v2.sql`** (en el futuro): es la única migración con fecha posterior a hoy (2026-04-30). Toca `brand_material`, no `weekly_plans` ni `content_ideas`. Sin colisión.

---

## Tabla de riesgos consolidada

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Race condition P6 (doble plan para mismo brand) | Baja (1 brand, runner secuencial) | Alto (plan duplicado) | RPC con `INSERT ... ON CONFLICT DO NOTHING` o `UNIQUE(brand_id, week_start)` |
| UPDATE sobreescribe estado avanzado (P7/P20) | Muy baja (runner secuencial) | Medio (estado regresado) | WHERE en UPDATE; error si 0 rows |
| Orphan plan si DELETE rollback falla (P6) | Muy baja | Bajo (cron lo expira) | Desaparece con RPC |
| Stories sin template si tabla vaciada (P10) | Muy baja (10 templates protegidos) | Medio (422 silencioso) | Guard explícito + error observable |
| FK migration P9 falla por orphans | **Nula** (0 orphans confirmados) | N/A | — |
| Caller de transitionWeeklyPlanStatus no maneja nuevo error (P20) | Media | Bajo (HTTP 500 controlado) | Auditar todos los callers |

---

## Preguntas para el humano

1. **¿Las stories deben entrar en la RPC atómica de P6?** Si sí, la firma de la RPC se complica (recibe tanto `parsedIdeas` como `storyRows`). Si no, el plan sigue teniendo dos INSERTs separados — solo los posts son atómicos.

2. **¿FK en `template_id`: `ON DELETE SET NULL` o `ON DELETE RESTRICT`?** La primera permite borrar templates y marca ideas con null (render 422 visible). La segunda bloquea el borrado. ¿Hay un flujo de gestión de templates que prevea borrarlos?

3. **`transitionWeeklyPlanStatus` con el UPDATE atómico**: si el estado cambió concurrentemente y el UPDATE devuelve 0 rows, ¿debe lanzar error o silenciosamente devolver el estado actual? Lanzar es más correcto (el caller puede reintentar), pero todos los callers actuales esperan éxito sin manejo de este caso específico.

4. **`detect-stuck-plans` bypasa la función de transición (UPDATE directo).** ¿Se debe conservar este bypass o pasar por `transitionWeeklyPlanStatus`? El bypass actual incluye su propio WHERE, es seguro, y evitar la doble lectura (SELECT + UPDATE) es más eficiente para un cron.

5. **¿La migración P9 debe ser `NOT NULL` o nullable?** Hoy `template_id` es nullable (posts no tienen template). La FK debe ser nullable para mantener esa propiedad.

---

## Propuesta de orden de implementación

### Prioridad 1 — P20 (transitionWeeklyPlanStatus atómico)

**Justificación:** Es el cambio más pequeño y el más ampliamente utilizado (8 callers). Hacerlo primero valida el patrón de `UPDATE ... WHERE status=$old RETURNING *` antes de meterlo en una RPC. Cambio en un solo archivo (`weekly-plan-service.ts`).

**Dependencias:** Ninguna. Autónomo.

**Pasos:**
1. Cambiar el UPDATE en línea 206 para añadir `.eq('status', current.status as string)`
2. Si `updated` es null (0 rows → estado cambió concurrentemente), lanzar `ConcurrentModificationError` con el estado actual
3. Auditar los 8 callers para añadir manejo de este nuevo error donde sea relevante

---

### Prioridad 2 — P6 (RPC atómica para posts)

**Justificación:** Elimina el rollback manual y la ventana de inconsistencia. La única pregunta abierta es si incluye stories (ver Pregunta 1 arriba).

**Dependencias:** Requiere `UNIQUE(brand_id, week_start)` en `weekly_plans` para que `ON CONFLICT DO NOTHING` funcione limpiamente.

**Pasos:**
1. Migración: `ADD UNIQUE(brand_id, week_start)` en `weekly_plans` (si no existe)
2. Crear función Postgres `create_weekly_plan(...)` con `BEGIN/COMMIT`, `INSERT ... ON CONFLICT`, `INSERT content_ideas (posts)`, devuelve `{plan_id, idea_ids}`
3. Reemplazar el bloque `INSERT weekly_plans + INSERT content_ideas` en `weekly-plan-service.ts` por `db.rpc('create_weekly_plan', ...)`
4. Mantener la signatura de `CreateWeeklyPlanResult` idéntica

---

### Prioridad 3 — P9 (FK en template_id)

**Justificación:** 0 orphans → migración de riesgo nulo. Previene una categoría de errores silenciosos futuros. Un ALTER TABLE simple.

**Dependencias:** Ninguna (datos limpios confirmados).

**Pasos:**
1. Migración: `ALTER TABLE content_ideas ADD CONSTRAINT fk_content_ideas_template_id FOREIGN KEY (template_id) REFERENCES story_templates(id) ON DELETE SET NULL`

---

### Prioridad 4 — P10 (guard explícito cuando K=0)

**Justificación:** Convierte un fallo silencioso (422 invisible) en un error explícito. Cambio en 2 líneas de `plan-week.ts`.

**Dependencias:** Ninguna.

**Pasos:**
1. Añadir después del bloque `templatesEnabled` (línea ~189): `if (templatesEnabled.length === 0) { log(...); return { type: 'fail', error: 'No story templates available...' }; }`

---

### Orden final recomendado

```
P20 → P6 → P9 → P10
```

P9 y P10 pueden hacerse en paralelo en el mismo commit (sin dependencias entre sí).

---

## Estrategia de testing

### P20 (transición atómica)

Para verificar que el UPDATE con WHERE previene over-write:
1. Insertar un plan en `ideas_ready`
2. Iniciar dos `transitionWeeklyPlanStatus` concurrentes hacia `client_reviewing`
3. Verificar que exactamente uno tiene éxito y el otro lanza `ConcurrentModificationError`

**El problema:** llamadas asíncronas desde Node.js a Supabase no son verdaderamente simultáneas. Para simular la race condition real:
- Opción A: Mock en el test — intercalar un UPDATE manual entre el SELECT y el UPDATE de la función
- Opción B: En el verify script, hacer UPDATE directo del estado a `client_reviewing` después de que la función lea el estado pero antes de que haga el UPDATE propio (usando `SLEEP` en un trigger de DB, no viable en Supabase hosted)
- **Opción práctica:** Test de idempotencia — llamar a la función dos veces consecutivas sobre el mismo plan. La segunda debería lanzar `ConcurrentModificationError` porque el estado ya cambió en la primera. Esto prueba el mecanismo aunque no la ventana exacta.

### P6 (RPC atómica)

Para verificar atomicidad de verdad:
1. Invocar la RPC con datos válidos → verificar plan + ideas creados juntos
2. Invocar la RPC con ideas que violarían un constraint (e.g., `position` duplicado) → verificar que **el plan tampoco se creó** (transacción completa)
3. Invocar la RPC dos veces con mismo `(brand_id, week_start)` → verificar idempotencia (segundo call devuelve el plan existente, no crea duplicado)

### P9 (FK constraint)

1. Insertar una idea con `template_id` de un template existente → OK
2. Insertar una idea con `template_id` de un UUID inexistente → debe fallar con FK violation
3. Borrar el template → verificar que `template_id` queda NULL en la idea (ON DELETE SET NULL)

### P10 (guard K=0)

1. En un entorno de test, mockear `story_templates` vacío o sobreescribir `templatesEnabled = []`
2. Verificar que `planWeekHandler` devuelve `{ type: 'fail', error: 'No story templates...' }` en lugar de insertar stories con `template_id=null`
3. Verificar que el plan no se crea (o se expira si ya se creó antes de detectar el problema)

**Nota general sobre testing de race conditions:** Las race conditions reales requieren ejecución concurrente real. Los scripts de verify existentes son single-threaded. Para una cobertura honesta de P6/P20, hace falta un test que lance dos promesas en paralelo hacia la DB y verifique el resultado. El verify script puede usar `Promise.all` con dos llamadas simultáneas al mismo endpoint, que sí crea concurrencia real a nivel de conexión de DB.
