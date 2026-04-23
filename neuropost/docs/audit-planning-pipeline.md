# Auditoría del Pipeline de Planificación Semanal

> **Fecha:** 2026-04-23  
> **Alcance:** Generación de plan semanal (posts + stories), renderizado, enrutamiento worker/cliente, ciclo de aprobación.  
> **Metodología:** Lectura directa de código fuente + migraciones SQL. Cada afirmación incluye `archivo:línea`.  
> **Estado de las rutas API verificadas:** `glob src/app/api/**/route.ts` ejecutado — rutas confirmadas.

---

## Sección 1 — Mapa de archivos del pipeline

### Archivos nucleares

| Archivo | Responsabilidad | Exports relevantes | Importado por |
|---|---|---|---|
| `src/lib/agents/strategy/plan-week.ts` | Orchestrador principal: carga brand, genera ideas, inserta plan + stories, enruta a worker/cliente | `planWeekHandler` | `src/lib/agents/registry.ts` (vía handler map) |
| `src/lib/agents/stories/plan-stories.ts` | Genera `StoryIdeaRow[]` a partir de brand + material; llama a Claude Haiku en batch | `planStoriesHandler`, `InspirationRef`, `MediaRef`, `StoryIdeaRow`, `PlanStoriesParams` | `src/lib/agents/strategy/plan-week.ts:39` |
| `src/lib/agents/stories/prompts.ts` | Construye los prompts para Claude (copy + imagePrompt) | `buildStoryCreativeBatchPrompt`, `buildQuotesPrompt`, `FALLBACK_QUOTES`, `StorySlotInput` | `src/lib/agents/stories/plan-stories.ts:26` |
| `src/lib/agents/strategy/generate-ideas.ts` | Llama a Claude para generar N ContentIdea[] con taxonomía | `generateIdeasForBrand` | `src/lib/agents/strategy/plan-week.ts:30` |
| `src/lib/planning/weekly-plan-service.ts` | Persistencia de `weekly_plans` + `content_ideas`; máquina de estados | `createWeeklyPlanFromOutput`, `transitionWeeklyPlanStatus` | `plan-week.ts:33,34`, `/api/client/weekly-plans/[id]/confirm/route.ts`, approve/reject routes |
| `src/lib/planning/parse-ideas.ts` | Convierte payload de agente en `ParsedIdea[]`; calcula `week_start` | `parseIdeasFromStrategyPayload`, `extractWeekStart` | `plan-week.ts:32`, `weekly-plan-service.ts:12` |
| `src/lib/planning/trigger-client-email.ts` | Envía email "plan listo para revisar" + inserta en `notifications` | `enqueueClientReviewEmail` | `plan-week.ts:35`, `/api/worker/weekly-plans/[id]/approve/route.ts:5` |
| `src/lib/idea-dispatch.ts` | Función pura: decide `worker_review` vs `client_review` | `routeIdea` | `plan-week.ts:36` |
| `src/lib/human-review.ts` | Lee y resuelve configuración de revisión humana | `getHumanReviewDefaults`, `resolveHumanReviewConfig` | `plan-week.ts:37` |
| `src/lib/plan-limits.ts` | Cuotas por plan; chequeos de límite; contadores | `PLAN_CONTENT_QUOTAS`, `checkStoryLimit`, `checkPostLimit` | `plan-week.ts:36`, `/api/worker/posts/route.ts:14` |
| `src/lib/stories/render.tsx` | Motor de renderizado: satori/next-og → PNG 1080×1920 | `renderStory` | `/api/render/story/[idea_id]/route.ts:13` |
| `src/app/api/render/story/[idea_id]/route.ts` | Endpoint HTTP: orquesta Replicate (si aplica) + render + upload | handler `POST` | `plan-week.ts:228` (fetch fire-and-forget) |

### Páginas de interfaz

| Archivo | Responsabilidad |
|---|---|
| `src/app/(dashboard)/planificacion/page.tsx` | Lista de planes semanales del cliente; filtros por estado |
| `src/app/(dashboard)/planificacion/[week_id]/page.tsx` | Vista de revisión del cliente: aprobar / editar / pedir variación / rechazar cada idea |
| `src/app/(worker)/worker/validation/page.tsx` | Cola de revisión del worker; WeeklyPlansQueue component |

### API Routes del pipeline

| Ruta | Método | Actor |
|---|---|---|
| `src/app/api/client/weekly-plans/route.ts` | GET | Cliente — lista planes |
| `src/app/api/client/weekly-plans/[id]/route.ts` | GET | Cliente — plan + ideas |
| `src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts` | PATCH | Cliente — acción sobre idea |
| `src/app/api/client/weekly-plans/[id]/confirm/route.ts` | POST | Cliente — confirmar plan |
| `src/app/api/client/weekly-plans/[id]/skip-week/route.ts` | POST | Cliente — saltar semana |
| `src/app/api/worker/weekly-plans/[id]/route.ts` | GET | Worker — plan + ideas |
| `src/app/api/worker/weekly-plans/[id]/approve/route.ts` | POST | Worker — aprobar plan |
| `src/app/api/worker/weekly-plans/[id]/reject/route.ts` | POST | Worker — rechazar plan |
| `src/app/api/worker/weekly-plans/[id]/ideas/[ideaId]/route.ts` | PATCH | Worker — editar idea |
| `src/app/api/worker/weekly-plans/pending/route.ts` | GET | Worker — planes pendientes |
| `src/app/api/render/story/[idea_id]/route.ts` | POST | Sistema — renderizar story |

### Helpers citados

| Función | Definida en |
|---|---|
| `buildSlots` | `src/lib/agents/stories/plan-stories.ts:182` |
| `generateIdeasForBrand` | `src/lib/agents/strategy/generate-ideas.ts` |
| `createWeeklyPlanFromOutput` | `src/lib/planning/weekly-plan-service.ts:71` |
| `routeIdea` | `src/lib/idea-dispatch.ts` |
| `enqueueClientReviewEmail` | `src/lib/planning/trigger-client-email.ts:16` |
| `checkStoryLimit` | `src/lib/plan-limits.ts:76` |

---

## Sección 2 — Esquema de DB real

### `weekly_plans`
**Fuente:** `supabase/schema_phase3.sql` + `supabase/migrations/20260420_sprint10_content_ideas_columns.sql` (referencias cruzadas)

| Columna | Tipo | Constraint / Default |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `brand_id` | `uuid` | FK `brands(id) ON DELETE CASCADE`, NOT NULL |
| `week_start` | `date` / `text` | NOT NULL — formato `YYYY-MM-DD` |
| `status` | `text` | CHECK enum (ver máquina de estados §3) |
| `parent_job_id` | `uuid` | FK `agent_jobs(id)`, nullable |
| `auto_approved` | `boolean` | DEFAULT `false` |
| `auto_approved_at` | `timestamptz` | nullable |
| `sent_to_client_at` | `timestamptz` | nullable — se escribe en `weekly-plan-service.ts:200` |
| `client_approved_at` | `timestamptz` | nullable — se escribe en `weekly-plan-service.ts:201` + `confirm/route.ts:48` |
| `client_first_action_at` | `timestamptz` | nullable — se escribe en `ideas/[ideaId]/route.ts:109` |
| `skip_reason` | `text` | nullable — se escribe en `reject/route.ts:21` |
| `created_at` | `timestamptz` | DEFAULT `now()` |

> ⚠️ **NO hay `UNIQUE(brand_id, week_start)`** verificado en las migraciones. La idempotencia se gestiona con `maybeSingle()` en código (`weekly-plan-service.ts:77-82`), no con constraint de DB — race condition teórica si dos jobs se ejecutan concurrentemente para la misma semana.

### `content_ideas`
**Fuente:** `supabase/schema.sql` + `supabase/migrations/20260420_sprint10_content_ideas_columns.sql` + `supabase/migrations/20260421_sprint12_render_columns.sql`

| Columna | Tipo | Constraint / Default |
|---|---|---|
| `id` | `uuid` | PK |
| `week_id` | `uuid` | FK `weekly_plans(id)` — NOT NULL |
| `brand_id` | `uuid` | FK `brands(id)` — NOT NULL |
| `position` | `int` | |
| `day_of_week` | `text` | nullable |
| `format` | `text` | `image\|carousel\|reel` |
| `angle` | `text` | |
| `hook` | `text` | nullable — **reutilizado como señal de control con prefijo `REPLICATE:`** |
| `copy_draft` | `text` | nullable |
| `client_edited_copy` | `text` | nullable |
| `client_edited_hashtags` | `text[]` | nullable |
| `hashtags` | `text[]` | nullable |
| `suggested_asset_url` | `text` | nullable |
| `rendered_image_url` | `text` | nullable — añadida en `20260420_sprint10_content_ideas_columns.sql:7` |
| `render_error` | `text` | nullable — añadida en `20260421_sprint12_render_columns.sql:3` |
| `status` | `text` | CHECK: `pending\|client_approved\|client_edited\|client_requested_variation\|client_rejected\|regenerating\|replaced_by_variation` |
| `awaiting_worker_review` | `boolean` | DEFAULT `false` |
| `content_kind` | `text` | CHECK `post\|story`, DEFAULT `'post'` — añadida `sprint10:4` |
| `story_type` | `text` | CHECK `NULL OR schedule\|quote\|promo\|data\|custom\|photo` — añadida `sprint10:5` |
| `template_id` | `uuid` | nullable — **SIN FK constraint** (verificado `sprint10:6`, no hay `REFERENCES`) |
| `approved_at` / `approved_by` | `timestamptz` / `uuid` | nullable |
| `rejected_at` / `rejected_by` | `timestamptz` / `uuid` | nullable |
| `reviewed_at` / `reviewed_by` | `timestamptz` / `uuid` | nullable — escritos por worker PATCH `ideas/[ideaId]/route.ts:40-41` |
| `agent_output_id` | `uuid` | nullable |
| `category_id` | `uuid` | nullable |
| `created_at` | `timestamptz` | DEFAULT `now()` |

**Índices:**
- `idx_content_ideas_kind_week ON (week_id, content_kind)` — `sprint10:21-22`

> ⚠️ **`template_id` no tiene FK constraint**. Si un template se borra, el render falla silenciosamente con 422.

### `story_templates`
**Fuente:** `supabase/migrations/20260420_sprint10_story_templates.sql`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | PK |
| `kind` | `text` | CHECK `system\|custom`, NOT NULL |
| `brand_id` | `uuid` | FK `brands(id) ON DELETE CASCADE`, nullable (`NULL` = system) |
| `name` | `text` | NOT NULL |
| `layout_config` | `jsonb` | NOT NULL |
| `preview_url` | `text` | nullable |

**Índices:** `idx_story_templates_kind(kind)`, `idx_story_templates_brand(brand_id) WHERE kind='custom'`  
**RLS:** SELECT system = todos los auth'd; SELECT custom = brand owner + workers + service_role  
**Seeds:** 10 templates de sistema insertados en la misma migración (`sprint10:62-73`)

### `brand_material`
**Fuente:** `supabase/migrations/20260420_sprint10_brand_material.sql`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | PK |
| `brand_id` | `uuid` | FK `brands(id) ON DELETE CASCADE`, NOT NULL |
| `category` | `text` | CHECK `schedule\|promo\|data\|quote\|free`, NOT NULL |
| `content` | `jsonb` | NOT NULL |
| `active` | `boolean` | DEFAULT `true`, NOT NULL |
| `valid_until` | `timestamptz` | nullable |
| `display_order` | `int` | DEFAULT 0 |

**Estructura de `content` por categoría** (documentada en COMMENT de tabla, `sprint10_brand_material.sql:18-25`):
- `schedule`: `{ "days": [{ "day": "monday", "hours": "7-22" }] }`
- `promo`: `{ "title": "...", "description": "...", "url": "..." }`
- `data`: `{ "label": "15 años", "description": "de experiencia" }`
- `quote`: `{ "text": "...", "author": "opcional" }`
- `free`: `{ "text": "..." }`

**Trigger:** `trigger_brand_material_updated_at` — actualiza `updated_at` en cada UPDATE.

### `worker_notifications`
**Fuente:** `supabase/worker_notifications.sql`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | `uuid` | PK |
| `type` | `text` | NOT NULL |
| `message` | `text` | NOT NULL |
| `brand_id` | `uuid` | FK `brands(id) ON DELETE CASCADE` |
| `brand_name` | `text` | nullable |
| `read` | `boolean` | DEFAULT `false` |
| `metadata` | `jsonb` | nullable |
| `created_at` | `timestamptz` | DEFAULT `now()` |

**Índices:** `idx_worker_notifications_read(read, created_at DESC)`, `idx_worker_notifications_brand(brand_id)`  
**RLS:** Solo workers activos pueden SELECT y UPDATE.

> ⚠️ **NO hay `UNIQUE(brand_id, type)` ni `UNIQUE(metadata->>'plan_id', type)`**. Insertar dos veces crea dos notificaciones duplicadas para el mismo plan.

### `agent_jobs`
**Fuente:** `supabase/agent_jobs.sql`

| Columna clave | Detalles |
|---|---|
| `status` | `pending\|running\|done\|error\|needs_review\|cancelled` |
| `max_attempts` | DEFAULT 3 — **el job de `regenerate_idea` tiene reintentos automáticos** |
| `requested_by` | `client\|worker\|cron\|agent` |
| `parent_job_id` | FK self-referencing ON DELETE SET NULL |

**Función atómica:** `claim_agent_jobs(p_limit)` usa `SELECT ... FOR UPDATE SKIP LOCKED` — patrón correcto para evitar race conditions en el runner.

### `client_feedback`
> ⚠️ **NO encontrada como migración SQL independiente**. Se escribe en `ideas/[ideaId]/route.ts:95-105` pero la definición de tabla no está en ninguna migración verificada. **NO VERIFICADA** — puede existir en `schema.sql` o migraciones no encontradas, o bien la tabla puede no existir en producción, lo que causaría que el INSERT falle silenciosamente (Supabase no lanza excepción en INSERT fallido sin `.throwOnError()`).

---

## Sección 3 — Flujo real paso a paso

### Paso 1 — Trigger: usuario genera plan
**Archivo:** `src/app/api/agents/planner/route.ts` (endpoint HTTP que inserta un `agent_job` con `action='plan_week'`) → procesado por `src/lib/agents/runner.ts` → dispatcher en `src/lib/agents/registry.ts` → llama a `planWeekHandler`.

✅ Coincide con lo esperado.

---

### Paso 2 — planWeekHandler: carga brand y quota
**Archivo:** `src/lib/agents/strategy/plan-week.ts:104-123`

```
:104  const brand = await loadBrand(job.brand_id);
:108  const rawPlan = brand?.plan as string | undefined;
:109  const plan = (rawPlan && rawPlan in PLAN_CONTENT_QUOTAS) ? rawPlan : 'starter';
:113  console.warn(`[plan-week] Unknown plan '${rawPlan}'...`);  // si plan desconocido
:116  const planQuota = PLAN_CONTENT_QUOTAS[plan];
:119  const postsPerWeek = planQuota?.posts_per_week ?? 2;
```

✅ Carga brand antes del LLM. Fallback a `'starter'` con warn.  
⚠️ `loadBrand` es una función helper; si falla (brand no existe), no hay manejo explícito — lanzaría y caería en el catch general `:275`.

---

### Paso 3 — generateIdeasForBrand
**Archivo:** `src/lib/agents/strategy/plan-week.ts:127`

```
:127  ({ ideas } = await generateIdeasForBrand(job.brand_id, count));
```

✅ Correctamente envuelto en try/catch `:129-138`. Maneja `NO_TAXONOMY` → `needs_review`, errores transientes → `retry`, resto → `fail`.

---

### Paso 4 — createWeeklyPlanFromOutput
**Archivo:** `src/lib/agents/strategy/plan-week.ts:157-164`, implementación en `src/lib/planning/weekly-plan-service.ts:71-171`

```
plan-week.ts:157   const { plan: weeklyPlan } = await createWeeklyPlanFromOutput({...});
weekly-plan-service.ts:77    SELECT maybeSingle() — idempotency check
weekly-plan-service.ts:115   INSERT weekly_plans (status='generating')
weekly-plan-service.ts:151   INSERT content_ideas (posts)
weekly-plan-service.ts:154   if (ideasErr) → DELETE weekly_plans  ← manual rollback
```

✅ Existe idempotencia por `maybeSingle()`.  
⚠️ **No hay transacción real de Postgres**. El "rollback" es un segundo `DELETE` (`weekly-plan-service.ts:155`). Si el proceso cae entre el INSERT de `weekly_plans` y el DELETE de rollback (p.ej. crash del servidor), queda un plan huérfano en status `'generating'` sin ideas.  
⚠️ **Race condition**: dos workers procesando el mismo job concurrentemente pasarían ambos el `maybeSingle()` check antes de que el primero complete el INSERT.

---

### Paso 5 — Transición generating → ideas_ready
**Archivo:** `src/lib/agents/strategy/plan-week.ts:166`

```
:166  await transitionWeeklyPlanStatus({ plan_id: planId, to: 'ideas_ready' });
```

Implementación en `weekly-plan-service.ts:178-221`:
- Lee estado actual (`:186-194`)
- Valida con `assertValidTransition` (`:196`)
- UPDATE sin WHERE en estado previo (`:204-209`)

⚠️ **El UPDATE no tiene `WHERE status = 'generating'`** (`weekly-plan-service.ts:204-209`). Si el estado cambió entre el SELECT y el UPDATE (otra llamada concurrente), puede sobrescribir un estado más avanzado. No es atómico.  
✅ `assertValidTransition` sí valida antes, pero entre la validación y el UPDATE no hay lock.

---

### Paso 6 — Carga brand_material + inspiration_refs + media_library en paralelo
**Archivo:** `src/lib/agents/strategy/plan-week.ts:171-203`

```
:171  const { data: material } = await db.from('brand_material').select('*')
        .eq('brand_id', job.brand_id).eq('active', true);

:188-203  const [{ data: inspirationRefs }, { data: mediaRefs }] = await Promise.all([
            db.from('inspiration_references').select('id, thumbnail_url')
              .eq('brand_id', ...).eq('is_saved', true).not('thumbnail_url', 'is', null),
            db.from('media_library').select('url')
              .eq('brand_id', ...).eq('type', 'image'),
          ]);
```

✅ `inspiration_refs` y `media_library` se cargan en paralelo.  
⚠️ **`brand_material` no está en el `Promise.all`** — se carga secuencialmente antes. Podría paralelizarse con las otras dos queries.  
⚠️ No hay manejo de error en ninguna de estas tres queries. Si alguna falla, `material`/`inspirationRefs`/`mediaRefs` será `null`, lo que resulta en arrays vacíos (`?? []`). Esto no rompe el flujo pero produce stories sin material real sin ninguna advertencia.

---

### Paso 7 — planStoriesHandler
**Archivo:** `src/lib/agents/strategy/plan-week.ts:202-211`, implementación en `src/lib/agents/stories/plan-stories.ts:242-294`

```
plan-week.ts:202   const storyRows = await planStoriesHandler({...inspiration_refs, media_refs});

plan-stories.ts:250   const slots = buildSlots(brand_material, stories_per_week);
plan-stories.ts:253   const creativeResults = await generateStoryCreativeContent(brand, slots);
plan-stories.ts:256   const allImages = shuffled([...inspiration thumbnails, ...media urls]);
plan-stories.ts:265   return slots.map((slot, idx) => ({
plan-stories.ts:270     hook: !imageUrl && creative.imagePrompt ? `REPLICATE:${creative.imagePrompt}` : null,
```

✅ Genera copy + imagePrompt en batch con Claude Haiku.  
✅ Prioridad imagen: inspiration → media → Replicate prompt en `hook`.  
⚠️ **Fallback silencioso si Claude falla** (`plan-stories.ts:120-129`): usa `FALLBACK_QUOTES` genéricas, sin notificar ni al caller ni al cliente.  
⚠️ **Parseo de schedule sin validación** (`plan-stories.ts:50-53`): asume `content.days as Array<{day, hours}>`. Si el JSONB no tiene esa estructura, `days` es `[]` y el copy del horario queda vacío.

---

### Paso 8 — INSERT stories en content_ideas
**Archivo:** `src/lib/agents/strategy/plan-week.ts:213-222`

```
:213  if (storyRows.length > 0) {
:214    const { data: insertedStories, error: storiesErr } = await db
:215      .from('content_ideas').insert(storyRows).select('id');
:218    if (storiesErr) {
:219      console.error('[plan-week] Failed to insert story ideas:', storiesErr.message);
:220    } else if (insertedStories?.length) { ... }
:221  }
```

⚠️ **Si el INSERT falla, solo hay un `console.error`**. El flujo CONTINÚA. El plan queda con posts pero sin stories. El cliente recibirá un plan incompleto sin saber qué pasó.  
⚠️ No hay transacción con los posts insertados en el paso 4. Posts e historias quedan en inserciones separadas.

---

### Paso 9 — Fire-and-forget a /api/render/story/{id}
**Archivo:** `src/lib/agents/strategy/plan-week.ts:222-230`

```
:222  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
:223  const renderFetches = (insertedStories as { id: string }[]).map(s =>
:224    fetch(`${baseUrl}/api/render/story/${s.id}`, {
:225      method: 'POST',
:226      headers: { 'Content-Type': 'application/json' },
:227    }).catch(e => console.warn(`[plan-week] render trigger failed for ${s.id}:`, e)),
:228  );
:229  Promise.allSettled(renderFetches).catch(() => {});
```

🔴 **CONFIRMADO: Fire-and-forget puro**. `Promise.allSettled(...).catch(() => {})`.  
- No se `await` el `Promise.allSettled` — la función continúa inmediatamente.  
- El `.catch(() => {})` absorbe cualquier rechazo del `allSettled` sin logging.  
- Cada `fetch` individual tiene su propio `.catch(e => console.warn(...))`, que sí loguea en consola. Pero consola no persiste en producción.  
- **Si el endpoint de render cae, falla silenciosamente. El cliente verá "Renderizando…" de manera indefinida.**

---

### Paso 10 — routeIdea decide worker_review vs client_review
**Archivo:** `src/lib/agents/strategy/plan-week.ts:241-253`

```
:233  const hrDefaults  = await getHumanReviewDefaults(db);
:234  const hrEffective = resolveHumanReviewConfig(brand.human_review_config ?? null, hrDefaults);
:235  const decision    = routeIdea(
:236    { content_kind: 'post', format: 'image', suggested_asset_url: null, rendered_image_url: null },
:237    hrEffective,
:238    { is_weekly_plan_event: true, is_regeneration: false },
:239  );
```

✅ Correctamente usa `is_weekly_plan_event: true`.  
⚠️ El objeto de idea es un placeholder hardcodeado con `content_kind: 'post'` y todo a null. No representa el estado real de las ideas.

---

### Paso 11 — Si worker_review → INSERT worker_notifications
**Archivo:** `src/lib/agents/strategy/plan-week.ts:246-270`

```
:246  if (decision.route === 'worker_review') {
:247    await db.from('worker_notifications').insert({
:248      type:     'needs_review',
:249      message:  `Plan semanal listo para revisar — semana del ${weekStart}`,
:250      brand_id: job.brand_id,
:251      read:     false,
:252      metadata: { plan_id: planId, week_start: weekStart, event: 'weekly_plan.ideas_ready', routing_reason: {...} },
:253    });
```

🔴 **El INSERT de `worker_notifications` no comprueba el error**. Supabase `db.from(...).insert(...)` devuelve `{ data, error }` pero no lanza excepción automáticamente. Si la inserción falla (p.ej., violación de constraint, timeout), **el código continúa silenciosamente**. El worker nunca verá la notificación. El plan queda en `ideas_ready` sin que nadie lo procese.  
⚠️ **No hay unique constraint** en `worker_notifications(brand_id, type)` ni en `metadata->>'plan_id'`. Una doble ejecución del job crea dos notificaciones para el mismo plan.

---

### Paso 12 — Si cliente → transición + email
**Archivo:** `src/lib/agents/strategy/plan-week.ts:263-265`

```
:263  await transitionWeeklyPlanStatus({ plan_id: planId, to: 'client_reviewing' });
:264  await enqueueClientReviewEmail(planId);
```

Implementación de `enqueueClientReviewEmail` en `src/lib/planning/trigger-client-email.ts`:

```
trigger-client-email.ts:25-28  if (!recipient) { console.error(...); return; }  ← retorno silencioso
trigger-client-email.ts:47-61  await sendEmail(...)  ← sin try/catch externo
trigger-client-email.ts:81-83  if (notifErr) { console.error(...) }  ← solo log, no throw
trigger-client-email.ts:91-92  console.error('[email/trigger] Error al enviar email:', result.error);
```

🔴 **`enqueueClientReviewEmail` NUNCA lanza excepción**. Todos los errores están capturados internamente con `console.error` + `return`. El caller (`plan-week.ts:264`) no puede saber si el email se envió.  
🔴 **Si el email falla**: el plan queda en `client_reviewing` pero el cliente no sabe que existe. No hay reintento, no hay flag en DB, no hay alerta al worker.  
⚠️ El `sent_to_client_at` solo se actualiza en `trigger-client-email.ts:87-89` si `result.ok`. Si falla, la columna queda `null`, lo que es la única señal (no observable en tiempo real) de que el email no se envió.

---

## Sección 4 — Análisis de fallos críticos

### a) Fire-and-forget de renders
**Archivo:** `src/lib/agents/strategy/plan-week.ts:229`

```typescript
Promise.allSettled(renderFetches).catch(() => {});
```

**CONFIRMADO**. El `await` está ausente. `Promise.allSettled` sin `await` lanza los fetches y libera el hilo inmediatamente. El `.catch(() => {})` en el `allSettled` absorbe silenciosamente cualquier error del propio `allSettled` (que no debería ocurrir, pero previene unhandled rejection). Cada fetch individual tiene `.catch(e => console.warn(...))` (`plan-week.ts:227`).

**Comportamiento en fallo:** render endpoint devuelve 500 → `console.warn` en servidor → `render_error` se escribe en DB (`render/route.ts:192-194`) → cliente ve "Renderizando…" para siempre o un error si la UI lee `render_error`.

---

### b) Fallo de INSERT en worker_notifications
**Archivo:** `src/lib/agents/strategy/plan-week.ts:247-253`

```typescript
await db.from('worker_notifications').insert({ ... });
// No hay: const { error } = ...; if (error) throw error;
```

**CONFIRMADO**. El resultado del INSERT se descarta. Si Supabase devuelve `{ data: null, error: PostgresError }`, el error se ignora. El plan queda en `ideas_ready` y el worker nunca es notificado. El plan se vuelve invisible para todos: el worker no lo ve, el cliente no recibe email porque la transición de estado ya no ocurre (están en ramas `if/else`).

---

### c) Fallo de email al cliente
**Archivo:** `src/lib/planning/trigger-client-email.ts:16-94`

**CONFIRMADO**. La función es `async ... : Promise<void>` y no lanza nunca. Los posibles fallos:
1. Plan no encontrado (`:25-28`): `return` silencioso
2. Recipient no resuelto (`:31-34`): `return` silencioso  
3. `sendEmail` falla: el resultado se loguea en consola (`:91-92`) pero no se propaga
4. INSERT de `notifications` falla (`:81-83`): solo `console.error`

**No hay reintentos**. El único rastro del fallo es `sent_to_client_at = null` en `weekly_plans`.

---

### d) Idempotencia del endpoint de render
**Archivo:** `src/app/api/render/story/[idea_id]/route.ts`

**CONFIRMADO: NO HAY idempotencia**. El endpoint carga la idea (`:27-34`) pero no comprueba si `rendered_image_url` ya está poblada. Un doble POST:
- Si `hook` tiene `REPLICATE:`: crea **dos predicciones en Replicate** (~$0.01-0.05 cada una) y sube **dos imágenes de fondo** a Storage.
- En cualquier caso: renderiza el PNG dos veces y lo sube con `upsert: true`, sobrescribiendo el anterior.
- Coste de duplicación: 2× llamada a Replicate + 2× sube Storage.

---

### e) Ausencia de story_templates (K=0)
**Archivo:** `src/lib/agents/strategy/plan-week.ts:180-189`

```typescript
:178  let templatesEnabled: string[] =
:179    brand.content_mix_preferences?.stories_templates_enabled ?? [];
:180  if (templatesEnabled.length === 0) {
:181    const { data: sysTpls } = await db.from('story_templates').select('id').eq('kind', 'system');
:185    templatesEnabled = (sysTpls ?? []).map((t: { id: string }) => t.id);
:186  }
```

Si `story_templates` está vacía (tabla sin seeds, o todos borrados):
- `sysTpls = []` → `templatesEnabled = []` → `K = 0`
- En `plan-stories.ts:290`: `K > 0 ? stories_templates_enabled[idx % K] ?? null : null` → `template_id = null`
- En render endpoint (`:40-42`): `if (!idea.template_id || !idea.brand_id) return 422`

**CONFIRMADO**: K=0 → todas las stories tienen `template_id=null` → render devuelve 422 para todas → todas quedan sin renderizar, sin ningún error visible al usuario. La migración `20260420_sprint10_story_templates.sql:62-73` semilla 10 templates, pero si se borran en producción el pipeline falla silenciosamente.

---

### f) Timeout de Replicate y AbortController
**Archivo:** `src/app/api/render/story/[idea_id]/route.ts:23-87`

```typescript
:23  const REPLICATE_POLL_INTERVAL_MS = 3_000;
:24  const REPLICATE_MAX_POLLS        = 30;   // 90s max

:68  for (let i = 0; i < REPLICATE_MAX_POLLS; i++) {
:69    await new Promise(r => setTimeout(r, REPLICATE_POLL_INTERVAL_MS));
```

**CONFIRMADO**: timeout de 90s, sin `AbortController`. El `fetch` de polling en la línea `:73` no tiene timeout propio. Si Replicate responde lento (HTTP 200 con latencia alta), el poll puede tardar más de 3s por iteración, excediendo los 90s efectivos. En el peor caso, con 30 polls × latencia alta + Replicate siendo lento, el proceso puede extenderse mucho más.

La función de Vercel tiene maxDuration de 300s (según documentación), por lo que 90s es conservador, pero sin AbortController no hay forma de cancelar un render en curso desde fuera.

---

### g) Fallback silencioso de Claude en plan-stories
**Archivo:** `src/lib/agents/stories/plan-stories.ts:120-129`

```typescript
:120  } catch (err) {
:121    console.warn('[plan-stories] Creative content generation failed, using fallback:', err);
:122    return slots.map((slot, i) => ({
:123      copy: slot.source !== null
:124        ? (buildCopyFromSource(slot.type, slot.source) || FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!)
:125        : FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!,
:126      imagePrompt: '',  // ← vacío: ninguna story del fallback tendrá imagen Replicate
:127    }));
:128  }
```

**CONFIRMADO**: Si Claude falla, el fallback usa `FALLBACK_QUOTES` genéricas ("Cada día es una oportunidad nueva.", etc.) sin ningún sector-awareness. El `imagePrompt` queda vacío (`''`), por lo que en `plan-stories.ts:270-272`:

```typescript
const hookValue = !imageUrl && creative.imagePrompt
  ? `REPLICATE:${creative.imagePrompt}`
  : null;
```

`creative.imagePrompt = ''` → condición falsa → `hook = null`. Resultado: stories sin imagen de fondo si no hay `inspiration_refs`/`media_refs`. El cliente, el worker, y los logs del plan nunca sabrán que Claude falló.

---

### h) Validación del schedule (content.days[].{day,hours})
**Archivo:** `src/lib/agents/stories/plan-stories.ts:50-53`

```typescript
case 'schedule': {
  const days = (c.days as Array<{ day: string; hours: string }>) ?? [];
  return days.map(d => `${translateDay(d.day)}: ${d.hours}`).join('\n');
}
```

**CONFIRMADO**: cast sin validación. Si `brand_material.content` tiene estructura diferente (p.ej., `{ "weekdays": [...] }` o `null`), `c.days` será `undefined`, `days` será `[]`, y el copy del horario queda como string vacío `''`. Esto no rompe el sistema pero la story de horario saldrá sin contenido.

---

### i) Polling desde /planificacion/[week_id]
**Archivo:** `src/app/(dashboard)/planificacion/[week_id]/page.tsx:100-106`

```typescript
:100  const needsPolling = ideas.some(
:101    (i) => i.status === 'regenerating' || i.awaiting_worker_review === true
:102  );
:103  if (!needsPolling) return;
:104  const interval = setInterval(() => { void load(); }, 10_000);
:105  return () => clearInterval(interval);
```

**CONFIRMADO**: intervalo fijo de 10 segundos, sin backoff exponencial, sin SSE/WebSocket. No existe condición de parada por tiempo (`ideas.status === 'render_failed'` u similar) para las stories en renderizado. Si una story queda en `rendered_image_url = null` pero `render_error` está seteado, el polling NO para (no está en la condición `:100-102`), así que el cliente seguirá pollando cada 10s indefinidamente mientras tenga la pestaña abierta.

---

### j) Worker rechaza → ¿el cliente se entera?
**Archivo:** `src/app/api/worker/weekly-plans/[id]/reject/route.ts:10-38`

```typescript
:21    await db.from('weekly_plans').update({ skip_reason: body.skip_reason }).eq('id', id);
:25-28 await db.from('content_ideas').update({ awaiting_worker_review: false })...;
:30    const plan = await transitionWeeklyPlanStatus({ plan_id: id, to: 'expired', ... });
// No hay: enqueueClientReviewEmail ni ninguna notificación al cliente
```

**CONFIRMADO: El cliente NO recibe ninguna notificación cuando el worker rechaza un plan**. El plan pasa a `expired`. Desde la perspectiva del cliente, el plan simplemente nunca aparece en `/planificacion`. No hay email, no hay notificación en la app, no hay `worker_notifications` de tipo `'plan_rejected'`.

---

### k) checkStoryLimit — ¿se llama desde alguna parte?
**Definida en:** `src/lib/plan-limits.ts:76`  
**Llamada desde:** `src/app/api/worker/posts/route.ts:66` — al momento de **publicar** un post de tipo story.  
**¿Se llama desde plan-week.ts o plan-stories.ts?** **NO**.

**CONFIRMADO**: la cuota `stories_per_week` de `PLAN_CONTENT_QUOTAS` se usa en `plan-week.ts:207` para decidir cuántas stories generar, pero `checkStoryLimit` (que verifica el contador real en DB) nunca se invoca durante la planificación. La limitación solo se aplica en el momento de publicación, no en la generación del plan.

---

### l) Edición de copy del cliente — ¿dispara re-render?
**Archivo:** `src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts:72-92`

```typescript
// action = 'edit':
ideaPatch = { status: 'client_edited', client_edited_copy: ..., client_edited_hashtags: ... }
await db.from('content_ideas').update(ideaPatch)...
// No hay: fetch('/api/render/story/...') ni nada similar
```

**CONFIRMADO: NO se dispara re-render**. Cuando el cliente edita el copy de una idea (post o story), solo se actualiza `client_edited_copy` en DB. La story renderizada (`rendered_image_url`) contiene el texto original `copy_draft`, no el texto editado. El cliente verá el nuevo texto en el badge de edición pero la imagen seguirá mostrando el texto antiguo hasta que el plan entre en producción y se regenere.

---

## Sección 5 — Inventario de efectos secundarios

| # | Efecto | Archivo:línea | ¿En transacción? | ¿Reintentos? | ¿Logging/Auditoría? | ¿Qué pasa si falla? | Coste si se duplica |
|---|---|---|---|---|---|---|---|
| 1 | INSERT `weekly_plans` | `weekly-plan-service.ts:115-130` | No (PostgREST) | No (runner tiene max_attempts=3) | `console.log` en `weekly-plan-service.ts:216` | Throws → job falla con `type:'fail'` | Plan duplicado si idempotency check tiene race |
| 2 | INSERT `content_ideas` (posts) | `weekly-plan-service.ts:151-157` | No (manual rollback) | No | `console.error` implícito | Manual DELETE del plan; plan desaparece, se puede reintentar | Ideas duplicadas si falla el rollback |
| 3 | Transition `generating→ideas_ready` | `plan-week.ts:166` | No | No | `console.log` en `weekly-plan-service.ts:216-218` | Throws → job falla con error | Doble UPDATE no es dañino |
| 4 | INSERT `content_ideas` (stories) | `plan-week.ts:213-220` | No | No | `console.error` en `:219` | **Solo log, flujo continúa.** Plan sin stories. | Ideas de stories duplicadas |
| 5 | Llamada a Claude Haiku (batch copy) | `plan-stories.ts:85-90` | No | No (fallback inmediato) | `console.warn` en `:121` | Fallback a FALLBACK_QUOTES genéricas, sin notificar | ~$0.002 por batch duplicado |
| 6 | Llamada a Replicate (Flux Dev) | `render/route.ts:40-61` | No | No (90s timeout total) | `console.log` en `:139` | `render_error` en DB; cliente ve error | ~$0.02-0.05 por imagen duplicada |
| 7 | Upload Supabase Storage (BG image) | `render/route.ts:143-151` | No | No | No | Throws → render falla; `render_error` en DB | ~$0.001 duplicado |
| 8 | UPDATE `suggested_asset_url` | `render/route.ts:155-157` | No | No | No | Throws → render falla | Sobrescribe con mismo valor |
| 9 | Upload Supabase Storage (PNG final) | `render/route.ts:167-172` | No | No | No | Throws → render falla | Sobrescribe con `upsert:true` |
| 10 | UPDATE `rendered_image_url` | `render/route.ts:177-180` | No | No | No | Throws → UPDATE `render_error` en `:192` | Sobrescribe |
| 11 | INSERT `worker_notifications` | `plan-week.ts:247-253` | No | No | **Ninguno si falla** | **Silencioso. Worker nunca notificado.** | Notificación duplicada (no hay unique constraint) |
| 12 | Transition `ideas_ready→client_reviewing` | `plan-week.ts:263` | No | No | `console.log` en service | Throws → job fail | Doble UPDATE no dañino |
| 13 | `enqueueClientReviewEmail` | `plan-week.ts:264` | No | No | `console.error` interno | **Silencioso. Cliente no notificado.** | Email duplicado al cliente |
| 14 | UPDATE `sent_to_client_at` | `trigger-client-email.ts:87-89` | No | No | `console.log` en `:90` | `sent_to_client_at` queda null | Sobrescribe con nueva fecha |
| 15 | INSERT `notifications` | `trigger-client-email.ts:66-79` | No | No | `console.error` en `:81-83` | Log solamente | Notificación duplicada al cliente |
| 16 | INSERT `client_feedback` | `ideas/[ideaId]/route.ts:95-105` | No | No | No | Silencioso | Registro duplicado de la acción |
| 17 | INSERT `agent_jobs` (regenerate_idea) | `ideas/[ideaId]/route.ts:114-129` | No | No | No | Throws → `apiError` → Sentry | Job duplicado → variación doble (previsto por guard 409 en status='regenerating') |
| 18 | UPDATE `content_ideas.awaiting_worker_review=false` | `approve/route.ts:19-22` | No | No | No | Throws → `apiError` | Doble UPDATE no dañino |
| 19 | queueJob × N (confirm) | `confirm/route.ts:55-82` | No | No | No | Parcial — algunos ideas en producción, otros no; plan pasa a `producing` igualmente | Jobs duplicados enviados a agentes |

---

## Sección 6 — Observabilidad actual

### ¿Hay `logAudit()` en este flujo?

`logAudit` **existe** en `src/lib/audit.ts:37` y hay helpers `logWorkerAction`, `logAgentAction`.

**Llamadas en el pipeline de planificación:**

```bash
grep logAudit/logWorkerAction/logAgentAction en:
  - src/lib/agents/strategy/plan-week.ts         → 0 llamadas
  - src/lib/planning/weekly-plan-service.ts       → 0 llamadas
  - src/lib/planning/trigger-client-email.ts      → 0 llamadas
  - src/app/api/worker/weekly-plans/*/route.ts    → 0 llamadas
  - src/app/api/client/weekly-plans/*/route.ts    → 0 llamadas
  - src/app/api/render/story/*/route.ts           → 0 llamadas
```

**Conclusión:** `logAudit` **NO se llama en ningún punto del pipeline de planificación**. La única auditoría estructurada es la tabla `client_feedback` (acciones del cliente) y los timestamps en `weekly_plans`/`content_ideas`. Las acciones del worker (aprobar, rechazar, editar) no tienen auditoría estructurada.

### ¿Hay console.log/console.error? ¿Se capturan en algún sitio?

**Sentry** está integrado (`src/lib/api-utils.ts:7`, `src/lib/agents/runner.ts:13`) pero de forma desigual:

| Dónde | Captura Sentry |
|---|---|
| `apiError()` helper | ✅ SÍ — todas las API routes que usan `apiError` → Sentry |
| `plan-week.ts` (agent handler) | ❌ NO — usa `console.warn/error`; el runner captura el error genérico del job (`runner.ts:202`) pero no los errores internos del handler |
| `plan-stories.ts` | ❌ NO — solo `console.warn` |
| `render/story/route.ts` | ❌ NO — usa `console.error`; el 500 devuelto puede capturarse por Sentry si el middleware lo intercepta, pero el handler no llama `apiError` |
| `trigger-client-email.ts` | ❌ NO — solo `console.error` |
| `weekly-plan-service.ts` | ❌ NO — solo `console.log` |

**Worker approve/reject routes**: Usan `apiError` en el catch general, por lo que los errores de validación de transición de estado sí van a Sentry.

### ¿`processing_timeline` se escribe desde este flujo?

`processing_timeline` está definido en `src/lib/agents/types.ts:45` como campo del tipo `AgentOutput`. **NO se escribe en ningún punto del pipeline de planificación** (no encontrado en plan-week.ts, plan-stories.ts, weekly-plan-service.ts, ni en la query de INSERT de `agent_outputs`).

### ¿Hay alguna forma hoy de saber "este plan está atascado"?

**Síntomas observables (no automáticos):**

| Síntoma | Señal disponible | Cómo verla |
|---|---|---|
| Plan sin stories | `stories_per_week > 0` pero `COUNT(content_ideas WHERE content_kind='story')=0` | Query manual |
| Story sin renderizar | `rendered_image_url IS NULL AND render_error IS NULL AND created_at < now()-5min` | Query manual |
| Story con error de render | `render_error IS NOT NULL` | UI del cliente o query |
| Worker no notificado | `status='ideas_ready' AND created_at < now()-30min` | Query manual |
| Email no enviado | `sent_to_client_at IS NULL AND status='client_reviewing'` | Query manual |
| Plan en `generating` > 5min | Probablemente huérfano | Query manual |

**No existe ningún dashboard, alerta automática, o cron que detecte planes atascados.**

---

## Sección 7 — Anti-patrones detectados

### a) `hook` como campo de control con prefijo "REPLICATE:"
**Archivo:** `src/lib/agents/stories/plan-stories.ts:270-272`

```typescript
const hookValue = !imageUrl && creative.imagePrompt
  ? `REPLICATE:${creative.imagePrompt}`
  : null;
```

Y en `src/app/api/render/story/[idea_id]/route.ts:112-113`:

```typescript
const hook = typeof idea.hook === 'string' ? idea.hook : null;
if (hook?.startsWith('REPLICATE:')) {
```

**Anti-patrón:** el campo `hook` (cuya semántica original es "gancho narrativo del post") se reutiliza como señal de control fuera de banda usando un prefijo de texto libre. No hay columna dedicada tipo `image_generation_prompt`. Si en el futuro un copy_draft legítimo empieza con "REPLICATE:", el sistema interpretaría eso como una instrucción de generación.

---

### b) `Promise.allSettled(...).catch(() => {})` — fire-and-forget sin feedback
**Archivo:** `src/lib/agents/strategy/plan-week.ts:229`

```typescript
Promise.allSettled(renderFetches).catch(() => {});
```

Detallado en §4a. Anti-patrón de durabilidad: efectos secundarios críticos iniciados sin posibilidad de recuperación o seguimiento.

---

### c) `await fetch(...)` sin await real — fire-and-forget
**Archivo:** `src/lib/agents/strategy/plan-week.ts:223-229`

```typescript
const renderFetches = (insertedStories as { id: string }[]).map(s =>
  fetch(`${baseUrl}/api/render/story/${s.id}`, { method: 'POST', ... })
    .catch(e => console.warn(...)),
);
Promise.allSettled(renderFetches).catch(() => {});
// No hay: await Promise.allSettled(...)
```

El `await` del `Promise.allSettled` está ausente. Los fetches se lanzan pero el handler no espera su resultado.

---

### d) UPDATE de status sin WHERE en estado previo (race condition)
**Archivo:** `src/lib/planning/weekly-plan-service.ts:204-209`

```typescript
const { data: updated } = await db
  .from('weekly_plans')
  .update({ status: params.to, ...extra })
  .eq('id', params.plan_id)
  // ← No hay: .eq('status', current.status)
  .select().single();
```

La validación de `assertValidTransition` ocurre en `:196` pero el UPDATE en `:204` no tiene `WHERE status = current.status`. Entre ambas líneas, otra instancia podría haber cambiado el estado. El UPDATE sobreescribiría el estado más nuevo con el estado calculado sobre datos obsoletos.

---

### e) Ausencia de transacciones donde deberían estar

1. **`weekly_plans` + `content_ideas` (posts)**: `weekly-plan-service.ts:115-158` — dos INSERTs sin BEGIN/COMMIT. El "rollback" es un DELETE separado que puede fallar.

2. **`content_ideas` (posts) + `content_ideas` (stories)**: `plan-week.ts:157-220` — dos INSERTs completamente desvinculados. No hay rollback de los posts si fallan las stories.

3. **`confirm/route.ts`** (`src/app/api/client/weekly-plans/[id]/confirm/route.ts:55-85`): `queueJob` en loop secuencial sin transacción. Si falla el job N de M, los jobs 1..N-1 ya están encolados y N..M no. El plan transiciona a `producing` igualmente en `:85`.

---

### f) Campos que mezclan "tipo de contenido" (post vs story) en una sola tabla

**Tabla:** `public.content_ideas`  
**Columnas:**
- `content_kind text CHECK('post','story')` — añadida en `sprint10:4`
- `story_type text CHECK(NULL OR 'schedule'|'quote'|'promo'|'data'|'custom'|'photo')` — solo relevante si `content_kind='story'`
- `template_id uuid` — solo relevante si `content_kind='story'`
- `rendered_image_url text` — solo relevante si `content_kind='story'` (posts usan `suggested_asset_url`)
- `render_error text` — ídem
- `hook text` — reutilizado como señal de control para stories

Posts y stories comparten tabla y la mayoría de columnas. Las columnas específicas de stories (`template_id`, `rendered_image_url`, `render_error`, `story_type`) son NULL para posts. Esto no es necesariamente un anti-patrón (Single Table Inheritance es aceptable), pero aumenta el riesgo de lógica condicional incorrecta y hace más difícil añadir constraints específicos por tipo.

---

## Sección 8 — Preguntas abiertas

Las siguientes cosas **no han podido verificarse** leyendo el código:

1. **¿`client_feedback` existe en producción?** La tabla se escribe en `ideas/[ideaId]/route.ts:95` pero no está en ninguna migración SQL de las encontradas. Podría estar en `schema.sql` en una sección no leída, o podría ser que la tabla no exista y los INSERTs fallen silenciosamente en producción.

2. **¿`content_ideas` tiene el campo `original_idea_id` para variaciones?** El agente de `regenerate_idea` lo mencionado en el análisis anterior crea ideas con este campo, pero no aparece en `20260420_sprint10_content_ideas_columns.sql`. ¿Está en otra migración?

3. **¿`brand.use_new_planning_flow` está activo para todos los brands en producción?** Todo el flujo analizado (incluido stories) solo se ejecuta si esta flag es `true` (`plan-week.ts:150`). ¿Cuántos brands tienen esta flag? ¿Hay un default?

4. **¿`regenerate_idea` handler está implementado?** Se inserta en `agent_jobs` con `action='regenerate_idea'` pero no he leído su implementación. ¿Existe? ¿Funciona?

5. **¿El runner procesa jobs de `plan_week` vía cron o vía trigger manual?** He visto referencias a `/api/cron/agent-queue-runner` pero no he leído el cron schedule. ¿Cada cuánto corre? ¿El plan se genera en tiempo real o hay latencia?

6. **¿Qué gestiona los estados `auto_approved` y `producing → calendar_ready → completed`?** Hay transiciones definidas en el estado machine pero no he encontrado qué las dispara.

7. **¿`app_settings.human_review_defaults` está inicializado en producción?** Si la fila no existe, `getHumanReviewDefaults` devuelve los `HARD_DEFAULT` (todos los flags = true), lo que fuerza worker review para todo. ¿Es así como está configurado?

8. **¿Hay algún job de limpieza/expiración para planes atascados en `generating` o `ideas_ready`?** El estado machine permite transición a `expired` pero no he encontrado ningún cron que la dispare automáticamente.

9. **¿El bucket `stories-rendered` en Supabase Storage es público o privado?** Las URLs se usan directamente como `img src` en la UI del cliente. Si el bucket es privado, las URLs expiran.

10. **¿Qué pasa con las stories cuando el cliente confirma el plan?** `confirm/route.ts` encola `generate_caption` + `generate_image` para posts aprobados. ¿Las stories también entran en producción? ¿Se publican en Instagram? No he encontrado ese flujo.

---

## Tabla resumen

| # | Problema | Severidad | Archivo:línea | Recomendación |
|---|---|---|---|---|
| P1 | Fire-and-forget renders — fallos silenciosos indefinidos | 🔴 | `plan-week.ts:229` | Persistir job de render en DB con estado; cron de reconciliación |
| P2 | INSERT `worker_notifications` sin check de error — worker nunca notificado | 🔴 | `plan-week.ts:247-253` | Añadir `const { error } = ...; if (error) throw error;` |
| P3 | `enqueueClientReviewEmail` nunca lanza — cliente no notificado sin saberlo | 🔴 | `trigger-client-email.ts:16-94` | Propagar el error; encolar con reintentos (Bull/DB outbox) |
| P4 | Worker rechaza plan — cliente no recibe ninguna notificación | 🔴 | `reject/route.ts:10-38` | Añadir `enqueueClientReviewEmail` con template "plan no disponible" o notificación in-app |
| P5 | INSERT stories falla — flujo continúa, plan incompleto sin aviso | 🔴 | `plan-week.ts:218-220` | Tratar como error fatal; devolver `{ type: 'fail' }` |
| P6 | No hay transacción real entre INSERT weekly_plan e INSERT content_ideas | 🔴 | `weekly-plan-service.ts:115-158` | Usar Postgres function / RPC atómico |
| P7 | UPDATE status sin `WHERE status = previous` — race condition | 🟡 | `weekly-plan-service.ts:204-209` | Añadir `.eq('status', current.status)` al UPDATE |
| P8 | Sin idempotencia en render — doble Replicate si POST duplicado | 🟡 | `render/route.ts` (ausencia) | Comprobar `rendered_image_url IS NULL` al inicio del handler |
| P9 | `template_id` sin FK constraint — template borrado = 422 silencioso | 🟡 | `sprint10_content_ideas.sql:6` | Añadir `REFERENCES public.story_templates(id)` o soft-delete |
| P10 | K=0 story templates → todas las stories sin template → 422 en render | 🟡 | `plan-week.ts:180-186` | Validar `templatesEnabled.length > 0` antes de proceder; error explícito |
| P11 | Fallback Claude silencioso — copy genérico sin notificar | 🟡 | `plan-stories.ts:120-129` | Marcar ideas generadas con fallback; mostrar advertencia al worker/cliente |
| P12 | `checkStoryLimit` no llamada durante planificación | 🟡 | `plan-week.ts` (ausencia) | Llamar antes de `planStoriesHandler`; devolver error si quota excedida |
| P13 | Edición de copy por cliente no dispara re-render de story | 🟡 | `ideas/[ideaId]/route.ts:72-92` | Fire-and-forget render con `client_edited_copy` como override |
| P14 | `logAudit` no llamado en ningún punto del pipeline | 🟡 | Todo el pipeline | Añadir `logAgentAction` en `plan-week.ts`, `logWorkerAction` en approve/reject |
| P15 | Sin unique constraint en `worker_notifications(plan_id, type)` — duplicados | 🟡 | `worker_notifications.sql` | Añadir `UNIQUE(brand_id, metadata->>'plan_id', type)` o check previo |
| P16 | Polling fijo 10s sin condición de parada para `render_error` | 🟢 | `planificacion/[week_id]/page.tsx:100-104` | Incluir `render_error IS NOT NULL` como condición de parada |
| P17 | `hook` reutilizado como señal de control con prefijo texto libre | 🟢 | `plan-stories.ts:270`, `render/route.ts:112` | Añadir columna dedicada `image_generation_prompt text` |
| P18 | `confirm/route.ts` encola jobs en loop sin transacción — fan-out parcial | 🟢 | `confirm/route.ts:55-82` | Encolar todo en un batch atómico o usar sub_jobs del runner |
| P19 | Parseo `content.days[].{day,hours}` sin validación — copy vacío silencioso | 🟢 | `plan-stories.ts:50-53` | Añadir guard: `if (!d?.day || !d?.hours) continue;` |
| P20 | `transitionWeeklyPlanStatus` hace SELECT + UPDATE sin lock — no atómico | 🟢 | `weekly-plan-service.ts:186-209` | Usar `UPDATE ... WHERE status = $old_status RETURNING *`; lanzar si 0 rows |
| P21 | Sentry no integrado en render endpoint ni en plan-week handler | 🟢 | `render/route.ts`, `plan-week.ts` | Usar `apiError()` helper o llamar `Sentry.captureException` en catches |
| P22 | `client_feedback` tabla no verificada en migraciones — posibles INSERTs fallidos silenciosos | 🟢 | `ideas/[ideaId]/route.ts:95` | Verificar existencia de tabla en producción; añadir `.throwOnError()` |
