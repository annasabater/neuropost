# Ciclo semanal detallado — 2026-04-22

> **Alcance:** trazado archivo por archivo del ciclo completo de planificación semanal, validación worker, generación multimedia y aprobación cliente en NeuroPost.
> **Estado:** Tanda 1 de 4 (Fases A + B). Se ampliará con Fases C / D-E / F en commits sucesivos.
> **Baselines que referencia:** [agents-audit.md](agents-audit.md), [photo-flow-inventory-2026-04-22.md](photo-flow-inventory-2026-04-22.md), [scheduler-zombie-diagnosis-2026-04-22.md](scheduler-zombie-diagnosis-2026-04-22.md), [data-compliance-audit.md](data-compliance-audit.md).
> **Regla interna:** "HOY hace X" vs "debería hacer Y" están separados; ningún comportamiento se inventa; todo cita `file:line`.

---

## Resumen ejecutivo

- El ciclo semanal existe en el código con máquina de estados formal ([weekly-plan-service.ts:21-33](../src/lib/planning/weekly-plan-service.ts#L21-L33)): `generating → ideas_ready → sent_to_client → client_reviewing → client_approved → producing → calendar_ready → completed`. Pero el transition `sent_to_client` **nunca se dispara en runtime** — el endpoint `/approve` salta de `ideas_ready` directamente a `client_reviewing`.
- Un **único cron** dispara el plan: `/api/cron/monday-brain` lunes 00:00 UTC → `queueWeeklyPipeline()` → step 5 `strategy:plan_week` con `count:5` hard-coded (ignora `postsPerWeek` del brand).
- **Feature flag `brand.use_new_planning_flow`** bifurca el comportamiento completo de `plan_week`. Brand SportArea (`e8dc77ef-…`) lo tiene `TRUE` — flujo nuevo activo. Para brands con el flag `FALSE` / `NULL`, el ciclo descrito aquí NO aplica: se saltan `weekly_plans` y se lanzan sub-jobs `generate_image` / `generate_caption` directos sin validación worker.
- **`human_review_config` es granular con 4 flags (`messages`, `images`, `videos`, `requests`)** pero **solo `.messages` se lee en código**. SportArea tiene `{"images":false,"videos":false,"messages":true,"requests":false}`; los flags `images`, `videos` y `requests` no producen efecto observable en el código actual — son campos declarados sin consumer.
- Los inputs que el agente de ideas realmente consulta son: `content_categories` (taxonomía pesada), `inspiration_references.is_saved=true` (favoritos LIMIT 10) y campos del brand. **NO** consulta biblioteca de fotos, vídeos del cliente, `special_requests`, `recreation_requests`, ni posts publicados recientes (solo el campo agregado `last_published_at` de las categorías).
- Existe un flujo QC paralelo (`proposals` table) con 5ª tab en `/worker/validation`, invisible en el modelo mental y con señales de posible legacy duplicado ([§A.5](#a5-flujo-paralelo-proposals--posible-legacy)).
- **Tabla `weekly_plans` existe en producción con 2 filas activas** (1 `calendar_ready`, 1 `ideas_ready`) pero su `CREATE TABLE` **no se encuentra en el repo** — solo aparece referenciada como FK. ❓ schema base fuera del control de versiones o en migración no indexada.

---

## 1. Índice de rutas implicadas

### Fase A — Planificación (cron, autónomo)

| Ruta / Archivo | Tipo | Fase | Lee | Escribe | Acciones usuario |
|---|---|---|---|---|---|
| [`/api/cron/monday-brain`](../src/app/api/cron/monday-brain/route.ts) | Route handler (cron) | A | `brands` | `agent_jobs` (pipeline) | N/A (cron Vercel) |
| [`/api/cron/seasonal-planner`](../src/app/api/cron/seasonal-planner/route.ts) | Route handler (cron) | A (mensual, paralelo) | `brands`, `seasonal_dates`, `posts` | `posts`, `agent_jobs` | N/A |
| [`/api/cron/recurring-posts`](../src/app/api/cron/recurring-posts/route.ts) | Route handler (cron) | A (horario, paralelo) | `recurring_posts` | `posts`, `agent_jobs` | N/A |
| [`src/lib/agents/pipelines/weekly.ts`](../src/lib/agents/pipelines/weekly.ts) | Library | A | `brands` | `agent_jobs` | — |
| [`src/lib/agents/strategy/plan-week.ts`](../src/lib/agents/strategy/plan-week.ts) | Handler | A | `brands`, `content_categories`, `inspiration_references`, `brand_material`, `story_templates` | `weekly_plans`, `content_ideas`, `worker_notifications`, `agent_outputs` | — |
| [`src/lib/agents/strategy/generate-ideas.ts`](../src/lib/agents/strategy/generate-ideas.ts) | Library | A | `content_categories`, `inspiration_references` | — (solo payload) | — |
| [`src/lib/agents/stories/plan-stories.ts`](../src/lib/agents/stories/plan-stories.ts) | Library | A | `brand_material`, `story_templates` | (devuelve rows; el caller los inserta) | — |
| [`src/lib/planning/weekly-plan-service.ts`](../src/lib/planning/weekly-plan-service.ts) | Library | A/B/C | `weekly_plans`, `content_ideas`, `agent_outputs` | `weekly_plans`, `content_ideas` | — |

### Fase B — Validación worker del plan

| Ruta / Archivo | Tipo | Fase | Lee | Escribe | Acciones usuario |
|---|---|---|---|---|---|
| [`/worker/validation`](../src/app/(worker)/worker/validation/page.tsx) | Client component (page) | B + E | `proposals` (directo) | `proposals` (directo) | Tabs: proposals / weekly-plans / retouches / cola / mis-tareas |
| [`_components/WeeklyPlansQueue.tsx`](../src/app/(worker)/worker/validation/_components/WeeklyPlansQueue.tsx) | Client component | B | vía `/api/worker/weekly-plans/pending` | — | Ver lista + abrir detalle |
| [`/worker/weekly-plans/[id]`](../src/app/(worker)/worker/weekly-plans/%5Bid%5D/page.tsx) | Client component (page) | B | vía `/api/worker/weekly-plans/[id]` | vía PATCH ideas + POST approve/reject | Editar idea (copy/hashtags), aprobar, rechazar |
| [`/api/worker/weekly-plans/pending`](../src/app/api/worker/weekly-plans/pending/route.ts) | Route handler | B | `weekly_plans` (status=ideas_ready), `content_ideas` (count) | — | — |
| [`/api/worker/weekly-plans/[id]`](../src/app/api/worker/weekly-plans/%5Bid%5D/route.ts) | Route handler | B | `weekly_plans`, `content_ideas` | — | — |
| [`/api/worker/weekly-plans/[id]/approve`](../src/app/api/worker/weekly-plans/%5Bid%5D/approve/route.ts) | Route handler | B→C | `weekly_plans` | `weekly_plans.status=client_reviewing`, `notifications`, email Resend | — |
| [`/api/worker/weekly-plans/[id]/reject`](../src/app/api/worker/weekly-plans/%5Bid%5D/reject/route.ts) | Route handler | B | `weekly_plans` | `weekly_plans.status=expired`, `skip_reason` | — |
| [`/api/worker/weekly-plans/[id]/ideas/[ideaId]`](../src/app/api/worker/weekly-plans/%5Bid%5D/ideas/%5BideaId%5D/route.ts) | Route handler | B | `content_ideas` | `content_ideas` (copy_draft, hashtags, angle, suggested_asset_url) | — |

### Fases posteriores (pendientes — se detallarán en tandas 2-4)

Stub de rutas ya inventariadas pero no trazadas aún:

- Fase C: [`/planificacion`](../src/app/(dashboard)/planificacion/page.tsx), [`/planificacion/[week_id]`](../src/app/(dashboard)/planificacion/%5Bweek_id%5D/page.tsx), [`_components/`](../src/app/(dashboard)/planificacion/_components) (CalendarView, PlanSidebar, RescheduleModal, RetouchModal), [`/ideas`](../src/app/(dashboard)/ideas).
- Fases D+E: [`/worker/central`](../src/app/(worker)/worker/central/page.tsx), [`/worker/clientes/[brandId]`](../src/app/(worker)/worker/clientes), `ColaQueue.tsx`, `ReclamadasQueue.tsx`, `RetouchQueue.tsx`, webhooks Replicate, `handlers/local.ts`, `handlers/validator.ts`, `handlers/materialize.ts`.
- Fase F: [`/feed`](../src/app/(dashboard)/feed), [`/calendar`](../src/app/(dashboard)/calendar), [`/posts/[id]`](../src/app/(dashboard)/posts/%5Bid%5D/page.tsx), [`/worker/retouch-requests/[id]`](../src/app/(worker)/worker/retouch-requests), `/api/cron/publish-scheduled`.

### Rutas fuera del ciclo (baja prioridad — pendientes de tanda final)

Cliente: `/analytics`, `/brand`, `/billing`, `/settings`, `/chat`, `/community`, `/competencia`, `/instagram`, `/soporte`, `/historial`, `/solicitudes` (⚠️ el nombre sugiere que participa en Fase A — confirmar en tanda C), `/notifications`, `/resumen`, `/dashboard`, `/inbox`, `/posts/new`, `/posts/new/generating`, `/posts/new/confirmation`, `/biblioteca` (⚠️ "fotos del cliente" del modelo mental → confirmar en tanda D), `/inspiracion` (⚠️ modelo mental lo cita como input — confirmar en tanda A2).

Worker: `/worker/actividad`, `/worker/admin`, `/worker/agents`, `/worker/analytics`, `/worker/anuncios`, `/worker/auditoria`, `/worker/business`, `/worker/feed`, `/worker/finanzas`, `/worker/inbox`, `/worker/metricas`, `/worker/mi-rendimiento`, `/worker/settings`, `/worker/tickets`.

---

## Fase A — Planificación (cron, autónomo)

### A.0. Feature flag `use_new_planning_flow` — bifurcación radical

[plan-week.ts:148](../src/lib/agents/strategy/plan-week.ts#L148) condiciona el comportamiento completo del handler al flag `brand.use_new_planning_flow`:

| Flag | Qué hace HOY |
|---|---|
| `TRUE` (SportArea) | Flujo "nuevo": persiste `weekly_plans` + `content_ideas`, transita a `ideas_ready`, notifica worker. **Ninguna** sub-job de `generate_image` / `generate_caption` se encola aquí ([plan-week.ts:244](../src/lib/agents/strategy/plan-week.ts#L244) `sub_jobs: []`). La generación del contenido se difiere a Fase D, **disparada más tarde por un actor distinto** (a trazar en Tanda 3). |
| `FALSE` / `NULL` (legacy) | Salta todo el bloque [plan-week.ts:148-246](../src/lib/agents/strategy/plan-week.ts#L148-L246) y entra en el path legacy [plan-week.ts:247-267](../src/lib/agents/strategy/plan-week.ts#L247-L267): fan-out directo de `content:generate_caption` + `content:generate_image` por cada idea con `priority != 'baja'`. **No hay ni `weekly_plan` ni validación worker**. El cliente recibe posts directos sin mediar la cola de `/worker/validation`. |

🔴 **Consecuencia arquitectónica:** dos pipelines semanales coexisten en el repo. Todo el análisis de Fases B/C que sigue solo aplica a brands con `use_new_planning_flow=TRUE`. Brands sin el flag no pasan por ninguna validación de plan.

### A.0.b. Granularidad del `human_review_config`

Tipo definido en [types/index.ts:58-63](../src/types/index.ts#L58-L63):

```ts
export interface HumanReviewConfig {
  messages: boolean;
  images:   boolean;
  videos:   boolean;
  requests: boolean;
}
```

**SportArea:** `{"images":false, "videos":false, "messages":true, "requests":false}`.

Uso real en código (grep exhaustivo en `src/`):

| Flag | ¿Se lee en runtime? | Archivo:línea | Efecto observable HOY |
|---|---|---|---|
| `messages` | ✅ **SÍ** | [plan-week.ts:218](../src/lib/agents/strategy/plan-week.ts#L218) | Gobierna si el plan semanal requiere worker review. `!== false` → notifica worker (estado `ideas_ready`). `=== false` → auto-aprueba: transita `ideas_ready → client_reviewing` y envía email al cliente directamente. |
| `images` | 🔴 **NO** | (sin consumer) | **Declarado pero sin lectura.** Grep sobre `src/` no encuentra ninguna lectura de `.images`. |
| `videos` | 🔴 **NO** | (sin consumer) | Igual que `images`. Sin consumer. |
| `requests` | 🔴 **NO** | (sin consumer) | Igual. Sin consumer. |

🔴 **Hallazgo crítico:** aunque el tipo sugiere control granular, **solo `messages` tiene efecto**. La configuración de SportArea `"images":false, "videos":false, "requests":false` no modifica ningún comportamiento observable. En particular, **`images:false` NO implica** que la aprobación del contenido generado (Fase E) se salte al worker y vaya al cliente; significa literalmente nada hoy. El handler de validación de imágenes ([validator.ts](../src/lib/agents/handlers/validator.ts)) tampoco consulta este flag (verificado por grep sobre `src/lib/agents/`).

**Consecuencias:**
- Interpretación del usuario ("solo 'messages' tiene review activado para este brand") es correcta en intención pero NO en efecto: los otros 3 flags no "desactivan" nada — nunca tuvieron un "activado" que desactivar.
- Potencial bug de producto: la UI de cliente (pestaña `settings` o similar) puede permitir editar estos flags y dar impresión de granularidad que el backend no implementa. Pendiente confirmar en Tanda 4 al inspeccionar `/settings`.

### A.0.c. Estado del schema `weekly_plans` en repo

- **En DB (producción):** tabla existe, 2 filas (1 `calendar_ready`, 1 `ideas_ready`). Schema funcional.
- **En repo:** ❓ **migración no localizable**. Grep `weekly_plans` en `supabase/` da solo FKs:
  - [migrations/20260420_create_retouch_requests.sql:7](../supabase/migrations/20260420_create_retouch_requests.sql#L7) (FK)
  - [migrations/20260421_create_schedule_changes.sql:8](../supabase/migrations/20260421_create_schedule_changes.sql#L8) (FK)
- Ningún `CREATE TABLE weekly_plans` ni `CREATE TABLE content_ideas` aparece en `supabase/migrations/`, `supabase/schema.sql`, `supabase/schema_agents_advanced.sql`, ni en `.sql` sueltos del directorio.
- Única columna añadida post-creación: [sprint10_content_ideas_columns.sql](../supabase/migrations/20260420_sprint10_content_ideas_columns.sql) (`content_kind`, `story_type`, `template_id`, `rendered_image_url`).

Distinto de "tabla no existe": **tabla existe en DB pero su migración de creación no está versionada en el repo**. Hallazgo para [data-compliance] y riesgo de drift schema ↔ código.

### A.1. Entry point — cron `monday-brain`

**Disparador:** `vercel.json` línea 16 → `/api/cron/monday-brain` con `0 0 * * 1` (lunes 00:00 UTC).

[monday-brain/route.ts:43-68](../src/app/api/cron/monday-brain/route.ts#L43-L68):
1. `SELECT id FROM brands WHERE plan IS NOT NULL` (filtro: brands activos con plan).
2. Por cada brand en batches de 30 (stagger 500ms): llama `queueWeeklyPipeline(brandId)`.
3. Error por brand no aborta el lote.

[pipelines/weekly.ts:67-113](../src/lib/agents/pipelines/weekly.ts#L67-L113) construye y encola la cadena:

```
parent anchor: strategy:intent:weekly_pipeline  (marcado 'done' inmediatamente, solo grouping)
 ├─ analytics:sync_post_metrics    offset +0 min
 ├─ analytics:recompute_weights    offset +2 min
 ├─ analytics:scan_trends          offset +4 min
 ├─ strategy:build_taxonomy        offset +6 min
 ├─ strategy:plan_week {count:5}   offset +8 min   ← genera weekly_plan
 └─ scheduling:auto_schedule_week  offset +12 min  ← pendiente de trazar (Tanda 2/3)
```

Todos con `requested_by='cron'`.

🟡 **Menor:** [weekly.ts:51](../src/lib/agents/pipelines/weekly.ts#L51) hard-codea `count:5`, ignorando `PLAN_CONTENT_QUOTAS[brand.plan].posts_per_week`. Para un brand starter con `postsPerWeek:2` esto produce 5 ideas, no 2. Misma observación ya registrada en [scheduler-zombie §4](scheduler-zombie-diagnosis-2026-04-22.md).

### A.2. Inputs del modelo mental vs inputs reales del agente

| Input del modelo mental | ¿El agente lo consulta HOY? | Evidencia | Marcador |
|---|---|---|---|
| Galería de fotos del cliente (biblioteca) | 🔴 **NO** | Grep `generate-ideas.ts` no toca `brand_photos`/`brand_material` en path principal. `plan-stories.ts` sí lee `brand_material` pero solo para ideas de stories (plan-week.ts:167-174), no para posts. | 🔴 |
| Vídeos del cliente | 🔴 **NO** | Igual. | 🔴 |
| Contenido publicado recientemente | ⚠️ **Parcial** | Solo indirecto: `content_categories.last_published_at` ([generate-ideas.ts:92-95](../src/lib/agents/strategy/generate-ideas.ts#L92-L95)). No inspecciona `posts` ni `post_analytics`. | ⚠️ |
| Sector / tono / reglas del brand | ✅ Sí | [generate-ideas.ts:230-234](../src/lib/agents/strategy/generate-ideas.ts#L230-L234) inyecta `brand.name + brand.sector + brand.brand_voice_doc`. `rules.forbiddenWords` / `forbiddenTopics` **no** se pasan al prompt. | ⚠️ |
| `postsPerWeek`, `preferredDays`, `preferredHours` | 🔴 `postsPerWeek` **ignorado** (pisado por `count:5` de monday-brain); `preferredDays`/`preferredHours` **no** se consultan | [weekly.ts:51](../src/lib/agents/pipelines/weekly.ts#L51), grep negativo en `plan-week.ts` y `generate-ideas.ts` | 🔴 |
| `/inspiracion` — solicitudes del cliente con fecha | 🔴 **NO** | Cero lecturas de `special_requests` o `recreation_requests` en `src/lib/agents/` (grep exhaustivo). | 🔴 |
| Favoritos del cliente | ✅ **SÍ** | [generate-ideas.ts:188-209](../src/lib/agents/strategy/generate-ideas.ts#L188-L209) lee `inspiration_references WHERE is_saved=true LIMIT 10`; inyecta `title / category / notes (120 chars) / style_tags` en el prompt. | ✅ |
| Taxonomía de contenido | ✅ **SÍ** | [generate-ideas.ts:219-228](../src/lib/agents/strategy/generate-ideas.ts#L219-L228). | ✅ |
| Material de marca (brand_material) | ⚠️ **Solo stories** | [plan-week.ts:167-174](../src/lib/agents/strategy/plan-week.ts#L167-L174). Posts principales no lo usan. | ⚠️ |

**Modelo mental punto 2 (contexto recopilado):** ⚠️ **parcial** — agentes recopilan mucho menos del que el usuario asume.
**Modelo mental punto 3 (`/inspiracion` solicitudes):** 🔴 **no existe** — ningún agente consulta special/recreation requests para construir el plan. Si el cliente pide un post específico, esa petición NO entra en el plan semanal por esta vía.

### A.3. Agente `strategy:plan_week` (new flow)

Secuencia en [plan-week.ts:94-246](../src/lib/agents/strategy/plan-week.ts#L94-L246):

1. Valida `job.brand_id`, carga brand.
2. Resuelve `plan` y `postsPerWeek` desde `PLAN_CONTENT_QUOTAS` (usa override `job.input.count` si viene — monday-brain envía 5).
3. Llama `generateIdeasForBrand()` — LLM Anthropic `claude-haiku-4-5-20251001`, temperatura defecto, max_tokens 2500, devuelve JSON estricto.
4. Si `brand.use_new_planning_flow=true`:
   - `extractWeekStart()` → próximo lunes.
   - `parseIdeasFromStrategyPayload()` → `ParsedIdea[]`.
   - `createWeeklyPlanFromOutput()` → INSERT `weekly_plans` (status=`generating`) + INSERT `content_ideas` (status=`pending`). Idempotente por `(brand_id, week_start)`.
   - `transitionWeeklyPlanStatus(to='ideas_ready')`.
   - **Stories:** lee `brand_material WHERE active=true` y `story_templates` (brand preference → fallback `kind='system'`). Llama `planStoriesHandler()` con `stories_per_week` del quota. INSERT rows en `content_ideas`.
   - ⚠️ **Para cada story insertada: `fetch('/api/render/story/[idea_id]', {method:POST})` fire-and-forget** ([plan-week.ts:205-213](../src/lib/agents/strategy/plan-week.ts#L205-L213)). Error del fetch se traga con `console.warn`; `Promise.allSettled(...)` sin await → la función retorna antes de que termine el render. Si el render falla no hay retry ni registro en `agent_jobs`. 🟠 degradado.
   - Ramifica por `human_review_config.messages` ([plan-week.ts:218](../src/lib/agents/strategy/plan-week.ts#L218)):
     - `messages !== false` → INSERT `worker_notifications {type:'needs_review'}`. Estado queda `ideas_ready` esperando worker.
     - `messages === false` → `transitionWeeklyPlanStatus(to='client_reviewing')` + `enqueueClientReviewEmail()` (salta worker).
   - Devuelve `type:'ok', outputs:[strategy payload], sub_jobs:[]` (sin fan-out).
5. Si flag false → path legacy (ver A.0).

### A.4. Tablas de Supabase tocadas en Fase A

| Tabla | Operación | Columnas relevantes | RLS |
|---|---|---|---|
| `brands` | READ | `plan`, `sector`, `brand_voice_doc`, `use_new_planning_flow`, `human_review_config`, `content_mix_preferences`, `rules` | ❓ no verificada en tanda |
| `content_categories` | READ | `category_key`, `weight`, `last_published_at`, `recommended_formats` | ❓ |
| `inspiration_references` | READ (favorites) | `title`, `notes`, `style_tags`, `category`, `is_saved` | ❓ |
| `brand_material` | READ | `active=true` | ❓ |
| `story_templates` | READ | `kind='system'` | ❓ |
| `weekly_plans` | INSERT + UPDATE status | `brand_id`, `week_start`, `status`, `parent_job_id`, `sent_to_client_at`, `client_approved_at`, `auto_approved`, `auto_approved_at`, `skip_reason` | ❓ schema no en repo (§A.0.c) |
| `content_ideas` | INSERT | `week_id`, `position`, `day_of_week`, `format`, `angle`, `hook`, `copy_draft`, `hashtags`, `suggested_asset_url`, `suggested_asset_id`, `category_id`, `content_kind`, `story_type`, `template_id`, `status='pending'` | ❓ |
| `worker_notifications` | INSERT | `type='needs_review'`, `brand_id`, `metadata.plan_id`, `metadata.week_start` | ❓ |
| `notifications` | INSERT (indirecto si auto-aprueba) | via `enqueueClientReviewEmail` | ❓ |
| `agent_outputs` | INSERT | `kind='strategy'`, `payload={ideas, plan_id, week_start}`, `model='claude-haiku-4-5-…'` | [agents-audit §1] |
| `agent_jobs` | READ/WRITE (via runner) | estándar | [agents-audit §1] |

### A.5. Flujo paralelo `proposals` — 🔴 posible legacy duplicado

Descubierto fuera del modelo mental. **Requiere decisión de producto** antes de escribir/leer más.

- **Tabla `proposals`:** `CREATE TABLE` **no localizable en repo** (idéntico síntoma que `weekly_plans`, §A.0.c). Estados observados: `pending_qc`, `qc_rejected_image`, `qc_rejected_caption`, `failed`, `converted_to_post`, `rejected`, `pending_visual`, `pending_copy`.
- **Writers (5):**
  - [handlers/local.ts:389](../src/lib/agents/handlers/local.ts#L389) — un handler de contenido inserta/actualiza `proposals` (a confirmar detalle en Tanda 3).
  - [worker/validation/page.tsx:135,158](../src/app/(worker)/worker/validation/page.tsx#L135) — UI cliente del worker actualiza directamente via `createBrowserClient` (sin API).
  - [worker/page.tsx:748,771](../src/app/(worker)/worker/page.tsx#L748) — **MISMO código duplicado** en la raíz `/worker`, con imports y lógica casi idénticos a `/worker/validation`.
  - [api/worker/posts/route.ts:241](../src/app/api/worker/posts/route.ts#L241) — al crear post desde approve, actualiza la proposal.
- **Readers:** `validation/page.tsx:65`, `worker/page.tsx:677`, `api/worker/validation-pending-counts/route.ts:15`.
- **UI tab:** 5ª tab `proposals` en `/worker/validation`, renderizada como "Propuestas (pieza individual)". Tiene atajos de teclado (A/R/E/N), visor de imagen, edición inline de caption, botones "regenerar imagen" / "regenerar copy" que solo actualizan `status` de la proposal y `retry_count` (no crean agent_jobs).

**Relación con Fase A/B del ciclo semanal:** ninguna conexión directa visible. `proposals` no referencia `weekly_plans` ni `content_ideas`. Parece un sistema QC single-post pre-weekly-plans. Cross-reference desde Fase B: [§B.5 Actions no disponibles al worker](#b5-acciones-que-el-worker-no-puede-hacer-en-el-plan).

**Hipótesis (a confirmar con producto):**
1. `proposals` es el predecesor directo de `weekly_plans` + `content_ideas` y quedó huérfano tras Sprint 10-12.
2. Coexiste intencionadamente para pipelines one-shot (p.ej. seasonal, ad-hoc) que no pasan por plan semanal.

Si (1): candidato a eliminación completa (tabla + 5 writers + 5ª tab + componentes duplicados `/worker/page.tsx`). Si (2): requiere documentación porque no hay comentario explicativo en ningún writer.

### A.6. Proveedores externos en Fase A

| Proveedor | Endpoint | Modelo | Tracking | Observación |
|---|---|---|---|---|
| Anthropic | `/v1/messages` | `claude-haiku-4-5-20251001` | ❓ no hay `trackCost` en [generate-ideas.ts:141](../src/lib/agents/strategy/generate-ideas.ts#L141) (a diferencia de `generate_image` que sí llama `trackCost`) | **Hueco de costes**: las llamadas LLM de ideas no se registran en `provider_costs`. [agents-audit §coste] lo esperaría. |

### A.7. UI que lo muestra durante Fase A

- **Cliente:** nada. El plan está `generating` → `ideas_ready` sin exposición al cliente. UI `/planificacion` filtra o no estos estados — pendiente de trazar en Tanda 2.
- **Worker:** solo cuando transiciona a `ideas_ready` aparece en `/worker/validation` tab `weekly-plans`.

### A.8. Estado del plan al entrar/salir de Fase A

| Entrada | Salida |
|---|---|
| `weekly_plans` no existe (primera vez) / `completed` o `expired` (ciclo anterior) | `ideas_ready` (ruta worker-review) **O** `client_reviewing` (ruta auto-aprobada via `human_review_config.messages=false`) |

### A.9. Cómo se notifica al siguiente actor

- Ruta worker-review: INSERT `worker_notifications` — 🟡 **no real-time** visible en `/worker/validation`; la tab `weekly-plans` solo carga al abrir la pestaña o pulsar "Recargar".
- Ruta auto-aprobada: email Resend + INSERT `notifications`. Real-time del cliente pendiente de confirmar en Tanda 2.

### A.10. Rupturas detectadas en Fase A

- 🔴 **`postsPerWeek` ignorado** — [weekly.ts:51](../src/lib/agents/pipelines/weekly.ts#L51) hard-codea `count:5`.
- 🔴 **`preferredDays` / `preferredHours` no consultados** — la asignación de `day_of_week` la hace el LLM sin contexto de preferencias.
- 🔴 **`special_requests` / `recreation_requests` no entran en el plan** — grep negativo.
- 🔴 **Flags `human_review_config.images/videos/requests` sin consumer** (§A.0.b).
- 🟠 **Render de stories fire-and-forget sin retry** ([plan-week.ts:205-213](../src/lib/agents/strategy/plan-week.ts#L205-L213)).
- 🟠 **Llamadas LLM de ideas no facturadas en `provider_costs`** (§A.6).
- 🟡 **Schema `weekly_plans` / `content_ideas` / `proposals` fuera del repo** (§A.0.c).
- 🟡 **Flujo paralelo `proposals` sin decisión** (§A.5).

---

## Fase B — Validación worker del plan

### B.1. Entry point

El worker abre `/worker/validation` ([validation/page.tsx](../src/app/(worker)/worker/validation/page.tsx)) y selecciona tab `weekly-plans`. No hay deep-link automático desde notificaciones (a confirmar: `worker_notifications` se lista en [`/worker/inbox`](../src/app/(worker)/worker/inbox) pero eso queda fuera de Tanda 1).

### B.2. Flujo

[WeeklyPlansQueue.tsx:28-42](../src/app/(worker)/worker/validation/_components/WeeklyPlansQueue.tsx#L28-L42) → GET `/api/worker/weekly-plans/pending`:

```
worker_notification (ideas_ready)          ← insertada al final de Fase A
     │  (no real-time, worker debe abrir tab o pulsar "Recargar")
     ▼
GET /api/worker/weekly-plans/pending
     │  SELECT weekly_plans WHERE status='ideas_ready'
     │  + SELECT count(content_ideas) per plan
     ▼
worker click "Revisar"
     │  router.push(`/worker/weekly-plans/${plan.id}`)
     ▼
GET /api/worker/weekly-plans/[id]
     │  SELECT weekly_plans + SELECT content_ideas ORDER BY position
     ▼
worker edita copy_draft / hashtags / angle / suggested_asset_url
     │  PATCH /api/worker/weekly-plans/[id]/ideas/[ideaId]  (debounce 1000ms)
     │  UPDATE content_ideas (4 campos permitidos)
     ▼
worker click "Aprobar"        |       "Rechazar"
     ▼                        ▼
POST /approve                  POST /reject
transitionWeeklyPlanStatus     UPDATE skip_reason
  'ideas_ready'                transitionWeeklyPlanStatus
  → 'client_reviewing'            'ideas_ready' → 'expired'
enqueueClientReviewEmail
  (Resend + notifications)
```

### B.3. Tablas tocadas en Fase B

| Tabla | Operación | Detalle |
|---|---|---|
| `weekly_plans` | READ + UPDATE (status, skip_reason, sent_to_client_at) | [approve/route.ts:13](../src/app/api/worker/weekly-plans/%5Bid%5D/approve/route.ts#L13), [reject/route.ts:21,23](../src/app/api/worker/weekly-plans/%5Bid%5D/reject/route.ts#L21) |
| `content_ideas` | READ + UPDATE (copy_draft, hashtags, angle, suggested_asset_url) | [ideas/[ideaId]/route.ts:25-41](../src/app/api/worker/weekly-plans/%5Bid%5D/ideas/%5BideaId%5D/route.ts#L25-L41) |
| `notifications` | INSERT (al aprobar) | via `enqueueClientReviewEmail` |

### B.4. Máquina de estados — discrepancia doc vs runtime

[weekly-plan-service.ts:21-33](../src/lib/planning/weekly-plan-service.ts#L21-L33) declara:

```
ideas_ready → [sent_to_client, client_reviewing, expired, skipped_by_client]
sent_to_client → [client_reviewing, auto_approved, expired]
```

**Runtime:** el path normal del approve **salta** `sent_to_client` y va directo a `client_reviewing`. Después `enqueueClientReviewEmail` ([trigger-client-email.ts:86-89](../src/lib/planning/trigger-client-email.ts#L86-L89)) escribe `sent_to_client_at` timestamp **sin** actualizar status. Resultado:

- El estado `sent_to_client` está declarado en la máquina pero nunca se materializa.
- La columna `sent_to_client_at` se llena aunque el status nunca haya pasado por ese valor.
- 🟡 inconsistencia documental: si algún consumer filtrara `WHERE status='sent_to_client'`, perdería registros.

### B.5. Acciones que el worker NO puede hacer en el plan

Comparado con el modelo mental ("worker puede editar ideas, cambiar fechas, añadir/quitar posts, rechazar todo"):

| Acción del modelo mental | Disponible en UI | Archivo | Marcador |
|---|---|---|---|
| Aprobar plan tal cual | ✅ Sí | [weekly-plans/[id]/page.tsx:161](../src/app/(worker)/worker/weekly-plans/%5Bid%5D/page.tsx#L161) | ✅ |
| Editar copy de una idea | ✅ Sí | [ideas/[ideaId]/route.ts:25](../src/app/api/worker/weekly-plans/%5Bid%5D/ideas/%5BideaId%5D/route.ts#L25) | ✅ |
| Editar hashtags de una idea | ✅ Sí | idem | ✅ |
| Editar `angle` de una idea | ✅ Sí (backend permite) pero ⚠️ **sin input en UI** (no hay `<input>` para `angle` en la página — solo se ve como label no-editable en línea 114) | [weekly-plans/[id]/page.tsx:114](../src/app/(worker)/worker/weekly-plans/%5Bid%5D/page.tsx#L114) | ⚠️ |
| Cambiar fecha (`day_of_week`, `scheduled_at`) | 🔴 **NO** | `day_of_week` no está en `allowed` de PATCH | 🔴 |
| Cambiar `format` (foto / reel / story / video) | 🔴 **NO** | idem | 🔴 |
| Añadir una idea nueva al plan | 🔴 **NO** | sin endpoint POST `/ideas` | 🔴 |
| Quitar una idea del plan | 🔴 **NO** | sin endpoint DELETE `/ideas/[ideaId]` | 🔴 |
| Reordenar ideas | 🔴 **NO** | `position` no se expone | 🔴 |
| Ver biblioteca / assets disponibles como contexto | 🔴 **NO** | Solo muestra `suggested_asset_url` si ya está en la idea | 🔴 |
| Editar story content separadamente | 🔴 **NO** | UI solo lista "ideas" genéricas; no distingue `content_kind='story'` | 🔴 |
| Rechazar plan entero | ✅ Sí | [reject/route.ts:23](../src/app/api/worker/weekly-plans/%5Bid%5D/reject/route.ts#L23) | ✅ |
| Rechazar una idea individual | 🔴 **NO** | status de `content_ideas` no se expone | 🔴 |

**Conclusión B.5:** la capacidad del worker se limita a texto (copy + hashtags + angle en backend-only) y decisión binaria (aprobar/rechazar todo). El modelo mental ("el worker puede editar fechas, añadir/quitar posts, rechazar ideas concretas") es 🔴 **distinto** al código actual.

Cross-reference: `proposals` flow (§A.5) **sí** permite regenerar caption/imagen y editar caption inline — el worker tiene más control sobre una `proposal` aislada que sobre una idea dentro de un `weekly_plan`. Asimetría candidata a revisión de producto.

### B.6. Estado del plan al entrar/salir de Fase B

| Entrada | Salida (ruta aprobar) | Salida (ruta rechazar) |
|---|---|---|
| `ideas_ready` | `client_reviewing` (salto de `sent_to_client`) + email enviado | `expired` + `skip_reason` |

### B.7. Notificación al siguiente actor

- **Aprobar:** `sendEmail(recipient.email, "Tu contenido de la semana … está listo para revisar", WeeklyPlanReadyEmail)` + INSERT `notifications {type:'weekly_plan.ready_for_client_review', metadata.review_url}`. Registro de `email_resend_id` / `email_error` en la misma fila de `notifications` ([trigger-client-email.ts:66-79](../src/lib/planning/trigger-client-email.ts#L66-L79)).
- **Rechazar:** sin notificación al cliente. El plan queda `expired` silenciosamente. 🟠 **degradado**: si el worker rechaza un plan el cliente nunca se entera (ni via email ni via notification).

### B.8. Rupturas detectadas en Fase B

- 🔴 **Capacidades worker muy por debajo del modelo mental** (§B.5).
- 🔴 **Campo `angle` editable en backend pero sin input en UI** — o sobra en backend, o falta en UI.
- 🟠 **Rechazo silencioso al cliente** (§B.7).
- 🟠 **Sin real-time en `/worker/validation/weekly-plans`** — worker depende de polling manual o de navegar a la tab; `worker_notifications` existe pero no se suscribe en esta vista.
- 🟡 **Status `sent_to_client` declarado pero nunca usado** (§B.4).
- 🟡 **Tab `proposals` en misma página** (§A.5) crea ambigüedad UX: el worker no tiene señal clara de cuál es "el" flujo vigente.

---

## Contraste con modelo mental — Fases A + B (puntos 1-8)

| # | Punto del modelo mental | Estado | Detalle |
|---|---|---|---|
| 1 | Cron dispara plan la semana anterior | ✅ | `monday-brain` lunes 00:00 UTC. "Semana anterior" en sentido laxo: el domingo 23:00 corre `global-trends` pero el plan nace el lunes mismo. |
| 2 | Agente recopila galería / vídeos / publicado / sector / tono / reglas / preferencias | ⚠️ | Ver tabla A.2. Solo sector/tono + taxonomía + favoritos + `last_published_at`. NO biblioteca, NO vídeos, NO reglas en prompt, NO preferencias de días/horas. |
| 3 | Agente consulta `/inspiracion` solicitudes con fecha específica | 🔴 | Ningún agente consulta `special_requests` / `recreation_requests`. |
| 4 | Agente junta todo y genera plan de N posts | ⚠️ | Sí genera plan, pero con menos inputs. `N` es `count:5` hard-coded, no `postsPerWeek` del brand. |
| 5 | Plan queda en estado intermedio pendiente de validar worker | ✅ | `ideas_ready` es ese estado, siempre que `brand.use_new_planning_flow=true` Y `human_review_config.messages !== false`. Hay dos formas de saltarse esto. |
| 6 | Worker ve planes pendientes | ✅ | `/worker/validation` tab `weekly-plans`. Sin real-time. |
| 7 | Worker puede aprobar/editar/cambiar fechas/añadir/quitar/rechazar | ⚠️🔴 | Aprobar/rechazar/editar-copy-y-hashtags ✅. Cambiar fechas, añadir, quitar, reordenar, rechazar ideas individuales 🔴. |
| 8 | Hasta que worker no valida, cliente NO ve nada | ⚠️ | Cierto en ruta "worker-review" (`ideas_ready` no expone al cliente). **Falso** en ruta "auto-aprobada" (`human_review_config.messages=false` ya envía email al cliente sin pasar por worker). Brands SportArea sí tienen `messages:true` → ruta worker-review. |

---

## Pendiente Tanda 2 (Fase C)

- Trazar `/planificacion` y `/planificacion/[week_id]` con `_components/CalendarView`, `PlanSidebar`, `RescheduleModal`, `RetouchModal`.
- Confirmar si `/ideas` y `/inspiracion` exponen solicitudes especiales que **sí** alimentan al plan por otra vía.
- Endpoint `/api/client/weekly-plans/[id]/confirm` → transición a `client_approved` y qué sub-jobs lanza.
- Cómo entra el plan `calendar_ready` (el ciclo anterior terminó en ese estado en producción — quién hace `producing → calendar_ready`).
- Validar que `RetouchModal` no es Fase F (retoque post-publicación) sino Fase C (retoque pre-aprobación) o confirmar ambigüedad.

## Preguntas abiertas — Tanda 1

- ❓ Schema real de `weekly_plans`, `content_ideas`, `proposals` (no en repo).
- ❓ RLS de las tres tablas.
- ❓ ¿Quién dispara `scheduling:auto_schedule_week` (step 6 de `weekly_pipeline`) y cómo se coordina con `client_approved`?
- ❓ ¿`proposals` se sigue alimentando hoy? (Requiere query: `SELECT COUNT(*), MAX(created_at) FROM proposals` en producción.)
- ❓ Flags `human_review_config.images/videos/requests` — ¿hay UI en `/settings` que permita editarlos? Si sí, ¿qué mensaje da al usuario? (Tanda 4.)
