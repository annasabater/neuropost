# Ciclo semanal detallado — 2026-04-22

> **Alcance:** trazado archivo por archivo del ciclo completo de planificación semanal, validación worker, generación multimedia y aprobación cliente en NeuroPost.
> **Estado:** Tanda 2 de 4 (Fases A + B + C). Se ampliará con Fases D-E / F en commits sucesivos.
> **Baselines que referencia:** [agents-audit.md](agents-audit.md), [photo-flow-inventory-2026-04-22.md](photo-flow-inventory-2026-04-22.md), [scheduler-zombie-diagnosis-2026-04-22.md](scheduler-zombie-diagnosis-2026-04-22.md), [data-compliance-audit.md](data-compliance-audit.md).
> **Regla interna:** "HOY hace X" vs "debería hacer Y" están separados; ningún comportamiento se inventa; todo cita `file:line`.

---

## Resumen ejecutivo

- El ciclo semanal existe en el código con máquina de estados formal ([weekly-plan-service.ts:21-33](../src/lib/planning/weekly-plan-service.ts#L21-L33)): `generating → ideas_ready → sent_to_client → client_reviewing → client_approved → producing → calendar_ready → completed`. Pero el transition `sent_to_client` **nunca se dispara en runtime** — el endpoint `/approve` salta de `ideas_ready` directamente a `client_reviewing`.
- Un **único cron** dispara el plan: `/api/cron/monday-brain` lunes 00:00 UTC → `queueWeeklyPipeline()` → step 5 `strategy:plan_week` con `count:5` hard-coded (ignora `postsPerWeek` del brand).
- **Feature flag `brand.use_new_planning_flow`** bifurca el comportamiento completo de `plan_week`. Brand SportArea (`e8dc77ef-…`) lo tiene `TRUE` — flujo nuevo activo. Para brands con el flag `FALSE` / `NULL`, el ciclo descrito aquí NO aplica: se saltan `weekly_plans` y se lanzan sub-jobs `generate_image` / `generate_caption` directos sin validación worker.
- **`human_review_config` es granular con 4 flags (`messages`, `images`, `videos`, `requests`)** pero **solo `.messages` se lee en código**. SportArea tiene `{"images":false,"videos":false,"messages":true,"requests":false}`; los flags `images`, `videos` y `requests` no producen efecto observable en el código actual — son campos declarados sin consumer.
- 🔴 **Ningún flag de `human_review_config` es editable desde UI.** Los 4 viven en DB sin interfaz cliente ni worker que los gestione — solo modificables vía SQL directo o `scripts/test_sprint3.ts` ([§A.0.b](#a0b-granularidad-del-human_review_config)).
- Los inputs que el agente de ideas realmente consulta son: `content_categories` (taxonomía pesada), `inspiration_references.is_saved=true` (favoritos LIMIT 10) y campos del brand. **NO** consulta biblioteca de fotos, vídeos del cliente, `special_requests`, `recreation_requests`, ni posts publicados recientes (solo el campo agregado `last_published_at` de las categorías).
- 🔴 **El cliente rellena 5 categorías de material de marca (`horarios`, `promociones`, `datos`, `frases`, `texto libre`) en [`/brand/material`](../src/app/(dashboard)/brand/material/page.tsx) — el agente principal de ideas NO las lee.** Solo `planStoriesHandler` consume `brand_material` y únicamente para generar stories, no posts ([§A.2](#a2-inputs-del-modelo-mental-vs-inputs-reales-del-agente)).
- Existe un flujo QC paralelo (`proposals` table) con 5ª tab en `/worker/validation`, invisible en el modelo mental y con señales de posible legacy duplicado ([§A.5](#a5-flujo-paralelo-proposals--posible-legacy)).
- **Tabla `weekly_plans` existe en producción con 2 filas activas** (1 `calendar_ready`, 1 `ideas_ready`) pero su `CREATE TABLE` **no se encuentra en el repo** — solo aparece referenciada como FK. ❓ schema base fuera del control de versiones o en migración no indexada.
- 🔴 **El endpoint `/confirm` NO pasa por `checkActionAllowed` / plan-gate.** Usa `queueJob` directo ([confirm/route.ts:56](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L56)), saltando el orchestrator. Un plan de 5 posts aprobado por un brand starter (`postsPerWeek:2`) **encola los 5 `generate_image` sin rechazo ni notificación**. Impacto de facturación: se gastan 5× costes de generación antes de que `checkPostLimit` tenga oportunidad de bloquear algo ([§C.3](#c3-fan-out-sin-gate--impacto-facturación)).
- 🔴 **Botón "pedir cambios" / "rechazar" en UI cliente no dispara ninguna acción sobre worker ni agente.** La tabla `client_feedback` se llena con INSERT en [ideas/[ideaId]/route.ts:77](../src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts#L77) pero **ningún lugar del código la lee**. Grep confirma: 3 matches totales (schema, tipo, INSERT); cero SELECT ([§C.4](#c4-client_feedback-tabla-write-only)).
- 🔴 **Stories del plan no generan contenido al confirmar — el fan-out del `/confirm` solo cubre posts.** Las 5 stories/semana del plan Crecimiento se "renderizan" en Fase A vía `fetch('/api/render/story/…')` fire-and-forget ([plan-week.ts:205-213](../src/lib/agents/strategy/plan-week.ts#L205-L213)); si ese fetch falla, el cliente aprueba un plan con ideas de story vacías y el confirm les encola un `generate_image` redundante con `format:'story'` que no conoce el template ([§C.5](#c5-stories-no-se-rerenderizan-al-confirmar)).
- 🔴 **Mismatch de formats entre TS enum, prompt LLM y checks de código.** Tipo declara `'image'|'reel'|'carousel'|'story'`; prompt LLM pide `"foto"|"carrusel"|"reel"|"story"|"video"`; los checks usan `format !== 'reel'` y `format === 'story'`. Ideas con `format:'video'` (salida válida del LLM, no en enum) pasan el check `!== 'reel'` y caen en el handler `generate_image` ([§C.6](#c6-format-mismatch-ts--llm--checks)).
- 🟡 **Plan real (`8b280580…`) tiene 3 posts en lugar de los 4 que declara la config** (Crecimiento = 4 posts + 5 stories). Diferencia menor; probablemente `generateIdeasForBrand()` devolvió menos ideas válidas que el `count:5` hard-coded y 2 eran de tipo story. A monitorizar, no bloqueante.

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
- 🔴 **`human_review_config` NO tiene UI editable en ningún lugar del repo.** Confirmado por grep: solo aparece en [src/types/index.ts:186](../src/types/index.ts#L186) (decl), [plan-week.ts:217-218](../src/lib/agents/strategy/plan-week.ts#L217-L218) (único consumer, solo `.messages`), [scripts/test_sprint3.ts](../scripts/test_sprint3.ts) (script de test), y este doc. No hay input, toggle, select ni form que lo modifique — ni en `/brand`, ni en `/settings`, ni en `/worker`.
- 🔴 **Consecuencia:** los 4 flags (`images`/`videos`/`messages`/`requests`) solo son modificables directamente en DB o vía `test_sprint3.ts`. `messages` sí tiene efecto (afecta a `plan-week`); `images`/`videos`/`requests` no se leen en ningún sitio → campos muertos en la tabla `brands`.
- 🔴 **Impacto producto:** el cliente NO puede configurar desde UI si quiere revisión humana o no. SportArea tiene `messages:true` pero ese valor llegó vía onboarding o INSERT directo, no vía configuración post-onboarding por el cliente.

### A.0.c. Estado del schema `weekly_plans` en repo

- **En DB (producción):** tabla existe, 2 filas (1 `calendar_ready`, 1 `ideas_ready`). Schema funcional.
- **Migración SQL:** ❓ **no localizable en repo**. Grep `weekly_plans` en `supabase/` da solo FKs:
  - [migrations/20260420_create_retouch_requests.sql:7](../supabase/migrations/20260420_create_retouch_requests.sql#L7) (FK)
  - [migrations/20260421_create_schedule_changes.sql:8](../supabase/migrations/20260421_create_schedule_changes.sql#L8) (FK)
- Ningún `CREATE TABLE weekly_plans` ni `CREATE TABLE content_ideas` aparece en `supabase/migrations/`, `supabase/schema.sql`, `supabase/schema_agents_advanced.sql`, ni en `.sql` sueltos del directorio.
- Única columna añadida post-creación: [sprint10_content_ideas_columns.sql](../supabase/migrations/20260420_sprint10_content_ideas_columns.sql) (`content_kind`, `story_type`, `template_id`, `rendered_image_url`).
- **Tipos TypeScript:** ✅ **sí declarados** en [types/index.ts:980-1012](../src/types/index.ts#L980-L1012) (`WeeklyPlan`, `WeeklyPlanStatus`) y [types/index.ts:1014-1080](../src/types/index.ts#L1014-L1080) (`ContentIdea`, `ContentIdeaFormat`, `ContentIdeaStatus`). No hay `database.types.ts` ni `supabase.types.ts` generado por Supabase CLI — los tipos son manuales.

Revelaciones al leer los tipos TypeScript:
- Columnas adicionales en `weekly_plans` no mencionadas en handlers ni endpoints: `client_first_action_at`, `reminder_2_sent_at`, `reminder_4_sent_at`, `reminder_6_sent_at`, `claimed_by`, `claimed_at` → sistema de claim y recordatorios que se usa solo parcialmente (ver §B.3 de reminders y §B.9).
- Columnas en `content_ideas` escritas/leídas por **nadie aún confirmado**: `client_edited_copy`, `client_edited_hashtags`, `final_copy`, `final_hashtags`, `proposal_id`, `post_id`. Los endpoints worker de Fase B solo tocan `copy_draft` y `hashtags` — los campos `client_edited_*` y `final_*` son para Fase C/D (trazar en Tanda 2/3).
- 🔴 **`proposal_id` en `content_ideas`:** existe una FK conceptual `content_ideas → proposals`. **Cambia mi hipótesis de §A.5**: `proposals` no es necesariamente legacy aislado; podría ser la representación de "pieza individual producida a partir de una idea aprobada". Confirmar en Tanda 3 (Fase D/E) quién popula `content_ideas.proposal_id`.
- 🔴 **Enum mismatch `ContentIdeaFormat`:** el tipo TS declara `'image' | 'reel' | 'carousel' | 'story'` pero el prompt LLM en [generate-ideas.ts:47](../src/lib/agents/strategy/generate-ideas.ts#L47) pide `"foto" | "carrusel" | "reel" | "story" | "video"`. Pares distintos: `"foto"` vs `"image"`, `"carrusel"` vs `"carousel"`, y `"video"` existe en el prompt pero no en el tipo. Hoy el INSERT ([weekly-plan-service.ts:141](../src/lib/planning/weekly-plan-service.ts#L141)) pasa `idea.format` directamente sin mapping. Los datos en DB probablemente tienen `"foto"` / `"carrusel"` — un `.eq('format','image')` en UI **no matchearía ningún registro**. Pendiente de verificar en Fase C cómo la UI filtra/renderiza.

Distinto de "tabla no existe": **tabla existe en DB pero su migración de creación no está versionada en el repo y los tipos TypeScript son manuales, no generados** — riesgo de drift schema ↔ código en ambos sentidos.

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
| `brand_material` categoría `schedule` (horarios) | ⚠️ **Solo stories** | [plan-stories.ts:133](../src/lib/agents/stories/plan-stories.ts#L133): `brand_material.find(m => m.category === 'schedule' && m.active)` → máximo 1 slot de tipo `schedule`. Usa `content` (JSON con `days[]`) y `active`. Generate-ideas grep negativo. | ⚠️ |
| `brand_material` categoría `promo` (promociones) | ⚠️ **Solo stories** | [plan-stories.ts:139-142](../src/lib/agents/stories/plan-stories.ts#L139-L142): filtra `category==='promo' && active` + `valid_until > now`, máx 3 slots. Usa `content` (title/description/url), `active`, `valid_until`. El agente principal de ideas **no** sabe de promociones vigentes. | 🔴 |
| `brand_material` categoría `data` (datos de negocio) | ⚠️ **Solo stories** | [plan-stories.ts:153](../src/lib/agents/stories/plan-stories.ts#L153): pool para round-robin de slots restantes. Usa `content` (label/description), `active`. | ⚠️ |
| `brand_material` categoría `quote` (frases) | ⚠️ **Solo stories** | [plan-stories.ts:152](../src/lib/agents/stories/plan-stories.ts#L152): pool round-robin. Si pool vacío, genera quote con LLM de fallback. Usa `content` (text/author), `active`. | ⚠️ |
| `brand_material` categoría `free` (texto libre) | 🔴 **NO** (mislabel) | [plan-stories.ts:154](../src/lib/agents/stories/plan-stories.ts#L154): mapeado a tipo `custom` de story, pool round-robin. Usa `content` (text), `active`. **El agente principal de ideas NO lo lee** — contradice el placeholder de la UI: "Escribe cualquier información relevante de tu marca que quieras que los agentes tengan en cuenta…". La copy promete que **los agentes** lo tendrán en cuenta; en realidad **solo stories** lo consume. | 🔴 |

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

**Runtime:** el path normal del approve **salta** `sent_to_client` y va directo a `client_reviewing`. Después `enqueueClientReviewEmail` ([trigger-client-email.ts:86-89](../src/lib/planning/trigger-client-email.ts#L86-L89)) escribe `sent_to_client_at` timestamp **sin** actualizar status.

**Writers del valor `status='sent_to_client'`** (grep exhaustivo sobre `src/`):

| Origen | ¿Asigna sobre `weekly_plans`? |
|---|---|
| [weekly-plan-service.ts:200](../src/lib/planning/weekly-plan-service.ts#L200) | Solo si alguien llamase `transitionWeeklyPlanStatus(to='sent_to_client')` — **nadie lo llama** |
| [worker/page.tsx:276](../src/app/(worker)/worker/page.tsx#L276) | ❌ NO — asigna sobre otra máquina (`QueueStatus` para `proposals`/cola clásica) |
| [ColaQueue.tsx:141](../src/app/(worker)/worker/validation/_components/ColaQueue.tsx#L141) | ❌ NO — idem (sobre `proposals`/cola, no weekly_plans) |

Conclusión: **el valor de status `sent_to_client` en `WeeklyPlanStatus` es huérfano** — declarado en el enum y en la máquina de estados, **nunca asignado** a ningún registro de `weekly_plans`.

**Readers del valor `status='sent_to_client'` en `weekly_plans`:**

| Archivo:línea | Tipo de lectura | Observación |
|---|---|---|
| [planificacion/page.tsx:22](../src/app/(dashboard)/planificacion/page.tsx#L22) | Define label UI `"Enviado"` | Label nunca se renderiza en producción porque ningún plan tiene ese status |
| [planificacion/page.tsx:36](../src/app/(dashboard)/planificacion/page.tsx#L36) | `REVIEWING_STATUSES = new Set(['client_reviewing', 'sent_to_client', 'ideas_ready'])` | El Set incluye el valor por precaución, pero en la práctica solo matchea `client_reviewing` e `ideas_ready` |
| [PlanSidebar.tsx:20](../src/app/(dashboard)/planificacion/_components/PlanSidebar.tsx#L20) | Mapa `dot + label` | Entrada del mapa nunca se resuelve |
| [`/api/client/weekly-plans/route.ts:25`](../src/app/api/client/weekly-plans/route.ts#L25) | Selecciona `sent_to_client_at` (timestamp) | Lee el timestamp, no el status |

**Readers del `sent_to_client_at` (timestamp, distinto del status):**

- [trigger-client-email.ts:88](../src/lib/planning/trigger-client-email.ts#L88) — escribe el timestamp al enviar email.
- [handlers/reminders.ts:38,49](../src/lib/agents/handlers/reminders.ts#L38) — lee el timestamp para decidir envío de recordatorios.
- [api/worker/metrics/route.ts:42,53](../src/app/api/worker/metrics/route.ts#L42) — usa el timestamp para calcular SLAs `generated → sent_to_client` y `sent_to_client → client_approved`.
- [planificacion/page.tsx:222-223](../src/app/(dashboard)/planificacion/page.tsx#L222-L223) — muestra "Enviado el DD/MM" a partir del timestamp.

**Resumen:**

- 🔴 **Status `sent_to_client` huérfano:** declarado en máquina, UI y enum; **nunca se asigna a un weekly_plan en runtime**. Si algún consumer filtrara `WHERE status='sent_to_client'`, resultado vacío garantizado.
- ✅ **Timestamp `sent_to_client_at` sí se usa:** desacopla la señal de "enviado al cliente" del campo status. Todos los consumers relevantes (reminders, metrics, UI planificacion) leen el timestamp directamente, no el status.
- 🟡 Inconsistencia documental severa: aparenta granularidad de estado que el runtime no implementa. Candidato a simplificación (eliminar valor del enum + máquina de estados) o a corrección (hacer que `approve` pase por `sent_to_client` antes de `client_reviewing`).

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

## C. Fase C — Cliente valida el plan

> **Alcance:** cliente entra a `/planificacion/[week_id]`, ve ideas individuales, aprueba/edita/rechaza cada una, y confirma el plan entero. El confirm debería lanzar la producción multimedia (Fase D). Traza real del endpoint `PATCH /api/client/weekly-plans/[id]/ideas/[ideaId]` y `POST /api/client/weekly-plans/[id]/confirm` contra el modelo mental.

### C.1. Entry point — transición `ideas_ready → client_reviewing`

La transición la dispara el worker en Fase B aprobando el plan (ver §B) **o** el agente directamente si `human_review_config.messages === false` ([plan-week.ts:235](../src/lib/agents/strategy/plan-week.ts#L235)). Al transitar a `client_reviewing` se envía `WeeklyPlanReadyEmail` con el link a `/planificacion/[week_id]`.

### C.2. PATCH por idea — acciones del cliente

[ideas/[ideaId]/route.ts](../src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts) expone 4 acciones vía `body.action`:

| Acción cliente | `content_ideas.status` resultante | Efecto runtime | Efecto `client_feedback` |
|---|---|---|---|
| `approve` | `client_approved` | Marca idea como lista para producir | INSERT con `previous_value`/`new_value` snapshot |
| `edit` | `client_edited` | Guarda `client_edited_copy` / `client_edited_hashtags` | INSERT |
| `request_variation` | `client_requested_variation` | **🔴 Ningún handler de agente procesa este estado.** Grep de `client_requested_variation` en `src/lib/agents/` = 0 matches. | INSERT (write-only) |
| `reject` | `client_rejected` | Idea queda descartada del fan-out en confirm (`producibles` solo incluye `client_approved`/`client_edited`) | INSERT (write-only) |

🔴 **Ruptura C.2.a:** `request_variation` no tiene consumer. El cliente pulsa "pedir variación", la idea queda en un estado terminal sin worker ni agente mirando. El plan luego no puede confirmarse porque `pending_idea_ids` ya no incluye esta idea (está en `client_requested_variation`, no en `pending`), así que pasa el filtro de confirm pero jamás se produce nada.

### C.3. Fan-out sin gate — impacto facturación

`POST /api/client/weekly-plans/[id]/confirm` ([confirm/route.ts](../src/app/api/client/weekly-plans/[id]/confirm/route.ts)) es el corazón de la transición Fase C → Fase D.

Secuencia:
1. Valida `plan.status === 'client_reviewing'` ([línea 27](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L27)).
2. Bloquea si hay ideas `pending` sin revisar ([línea 39](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L39)) → 400.
3. Transita `client_reviewing → client_approved` + `client_approved_at = now()`.
4. Filtra `producibles` = ideas con status `client_approved` OR `client_edited`.
5. **Por cada idea productible, queueJob directo** ([líneas 55-81](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L55-L81)):
   - Siempre: `content:generate_caption` (prioridad 60).
   - Si `idea.format !== 'reel'`: `content:generate_image` (prioridad 60, con `format` mapeado a `'story'`/`'post'`).
6. UPDATE idea `status = 'in_production'`.
7. Transita `client_approved → producing`.

🔴 **Hallazgo crítico — plan-gate bypass:**

El orchestrator ([orchestrator.ts:109-112](../src/lib/agents/orchestrator.ts#L109-L112)) aplica `checkActionAllowed()` antes de encolar. **El confirm NO usa `orchestrateJob()`**, usa `queueJob` directo ([confirm/route.ts:56-80](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L55-L81)). Consecuencia:

| Escenario | Plan-gate por `orchestrateJob` | Plan-gate por `/confirm` |
|---|---|---|
| Brand starter (`postsPerWeek:2`), plan aprobado con 5 posts | ❌ **402** en job 3/4/5 | ✅ **200**, encola los 5 `generate_image` |
| Brand con `autoPublish:false`, plan aprobado | Sin efecto (gate es por acción, no por plan global) | Igual |

**Impacto facturación (brand Crecimiento con 4 posts + 5 stories):**
- `generate_caption` está en `FREE_ACTIONS` ([plan-gate.ts:51](../src/lib/agents/plan-gate.ts#L51)) — gratis.
- `generate_image` está en `POST_QUOTA_ACTIONS` ([plan-gate.ts:25](../src/lib/agents/plan-gate.ts#L25)) — **debería** gatearse con `checkPostLimit`. Pero el confirm lo encola sin gate. Un bug adicional de `checkPostLimit`: lee `brand.posts_this_week`, contador que se incrementa **solo** al publicar ([plan-limits.ts:18-36](../src/lib/plan-limits.ts#L18-L36)), no al encolar. Incluso si el gate se activara, no bloquearía la ráfaga de 5 jobs lanzados en el mismo segundo.
- Ideas con `format:'story'` pasan el check `!== 'reel'` → encolan un `generate_image` con `format:'story'`. No es el job que genera realmente la story (ese es `/api/render/story/[idea_id]`, ver §C.5). Este `generate_image` intentará regenerar una imagen 1:1 para una idea que ya tiene `rendered_image_url` como PNG 1080×1920 → **doble gasto y output inconsistente**.
- Ideas con `format:'video'` (valor devuelto a veces por el LLM — ver §C.6) pasan `!== 'reel'` → también encolan `generate_image`. Un video no debería generar una imagen.

🔴 **Rechazo: silencioso.** Si el brand excede quota de forma oculta (por ejemplo, cuota agotada por `seasonal-planner` u otro cron), los jobs encolados fallarán individualmente dentro del worker sin volver al plan. El plan queda en `producing` sin transición a `calendar_ready`.

### C.4. `client_feedback` — tabla write-only

Búsqueda exhaustiva en `neuropost/src`:

| Archivo | Operación |
|---|---|
| [src/scripts/worker-schema.sql:31](../src/scripts/worker-schema.sql#L31) | Declaración de columna `client_feedback text` (tabla distinta `worker_*`, no relacionada) |
| [src/types/index.ts:906](../src/types/index.ts#L906) | Declaración de tipo `client_feedback: string \| null` sobre `ContentIdea` |
| [ideas/[ideaId]/route.ts:77](../src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts#L77) | **Único INSERT** en tabla `client_feedback` |

**Cero SELECTs.** Ninguna ruta worker (`/worker/*`), ningún agente (`src/lib/agents/**`), ningún cron (`src/app/api/cron/*`) lee la tabla. Los campos `comment` y `previous_value` que captura el PATCH se guardan sin destinatario.

🔴 **Consecuencia:**
- Si el cliente rechaza una idea con `comment: "no me gusta, quiero algo más alegre"`, ese comentario queda en DB y **ningún humano lo ve**. El worker no tiene `/worker/validation` que exponga `client_feedback`; el agente de re-generación no lo consulta (no existe el agente).
- `request_variation` idem: el comentario se pierde.
- La tabla es útil solo como **audit trail forense** a posteriori (SELECT manual en Supabase). No como canal de feedback operativo.

### C.5. Stories no se re-renderizan al confirmar

**Render real de stories:** sucede en Fase A dentro de `plan-week.ts:205-213`:

```ts
fetch(`${baseUrl}/api/render/story/${s.id}`, { method: 'POST', ... })
  .catch(err => console.warn(...));  // fire-and-forget, sin await
```

El endpoint [render/story/[idea_id]/route.ts](../src/app/api/render/story/[idea_id]/route.ts) hace: carga idea → valida `content_kind === 'story'` + `template_id` + `brand_id` → `renderStory()` produce PNG 1080×1920 → upload a bucket `stories-rendered` → UPDATE `rendered_image_url`.

**En Fase C, al confirmar el plan:**
- El fan-out de `/confirm` NO distingue entre posts y stories. Filtra por `status`, no por `content_kind`.
- Para ideas con `content_kind:'story'`:
  - Encola `generate_caption` → el handler hace LLM sobre una idea que ya tiene `copy_draft` (probablemente redundante).
  - Encola `generate_image` con `format:'story'` → intenta generar una foto 1:1 o 9:16 para una idea cuyo "contenido" es un PNG ya renderizado con template. **Conflicto de pipeline.**
- El re-render vía `/api/render/story/[idea_id]` **no se dispara desde /confirm**. No hay retry, no hay recuperación si el fetch fire-and-forget de Fase A falló.

🔴 **Consecuencia:**
- Si el render inicial falló (warning silencioso en console de Vercel), el cliente aprueba un plan cuyas stories tienen `rendered_image_url = null` + `render_error` cargado. El confirm no detecta esto, el pipeline de producción genera una imagen-post inútil, y al publicar no habrá nada que enseñar.
- Las "5 stories/semana" del plan Crecimiento son una promesa no cumplida en el camino feliz si `/api/render/story/` tiene el más mínimo fallo. Monitoreo actual para esto: ninguno.

### C.6. Format mismatch — TS ↔ LLM ↔ checks

**Enum TypeScript** ([types/index.ts:~1020](../src/types/index.ts)):
```ts
type ContentIdeaFormat = 'image' | 'reel' | 'carousel' | 'story';
```

**Prompt LLM** ([generate-ideas.ts:47](../src/lib/agents/strategy/generate-ideas.ts#L47)) pide:
```
"foto" | "carrusel" | "reel" | "story" | "video"
```

**Checks en código que comparan `idea.format`:**

| Archivo:línea | Comparación | Ramas |
|---|---|---|
| [plan-week.ts:78](../src/lib/agents/strategy/plan-week.ts#L78) | `format !== 'video' && format !== 'reel'` | Si `!==` → no encola `generate_video` |
| [plan-week.ts:85](../src/lib/agents/strategy/plan-week.ts#L85) | `format === 'story' ? 'story' : 'post'` | Mapping a campo `format` del sub-job |
| [reminders.ts:194](../src/lib/agents/handlers/reminders.ts#L194) | `format !== 'reel'` | Skip video reminder |
| [reminders.ts:204](../src/lib/agents/handlers/reminders.ts#L204) | `format === 'story' ? 'story' : 'post'` | Idem |
| [confirm/route.ts:67](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L67) | `format !== 'reel'` | Encola `generate_image` si no es reel |
| [confirm/route.ts:77](../src/app/api/client/weekly-plans/[id]/confirm/route.ts#L77) | `format === 'story' ? 'story' : 'post'` | Mapping en `input.format` |

**Tabla de comportamiento real por valor:**

| Valor en DB | Origen | `!== 'reel'` (image check) | `=== 'story'` | Handler efectivo |
|---|---|---|---|---|
| `'foto'` | LLM | TRUE → encola `generate_image` con `format:'post'` | FALSE | image-post ✅ |
| `'carrusel'` | LLM | TRUE → encola `generate_image` con `format:'post'` | FALSE | image-post ⚠️ (carrusel necesitaría pipeline distinto para N imágenes) |
| `'reel'` | LLM / enum | FALSE → no encola image | FALSE | No hay caption de vídeo en confirm; se asume reel se genera en otra ruta ⚠️ |
| `'story'` | LLM / enum | TRUE → encola `generate_image` con `format:'story'` | TRUE | 🔴 doble pipeline (ver §C.5) |
| `'video'` | LLM (fuera de enum) | TRUE → encola `generate_image` con `format:'post'` | FALSE | 🔴 se trata como foto |
| `'image'` | enum, **no producido** por LLM | — | — | Dead value |
| `'carousel'` | enum, **no producido** por LLM | — | — | Dead value |

🔴 **Consecuencias:**
- `'carousel'` e `'image'` están declarados en TS pero el agente genera `'carrusel'` y `'foto'`. Cualquier query UI `.eq('format', 'carousel')` devuelve 0 filas ([§A.0.c](#a0c-estado-del-schema-weekly_plans-en-repo) ya lo anticipó).
- `'video'` no está en el enum pero sí lo produce el LLM a veces. Cae en el default branch del check `!== 'reel'` → genera imagen. Output roto.
- Falta un `format:'carrusel'` check dedicado. La generación trata carrusel como post de 1 imagen.

### C.7. Botones UI sin efecto observable

Cross-ref §C.2 + §C.4:

| Acción UI cliente | Efecto DB | Efecto pipeline | Efecto notificación worker/agente |
|---|---|---|---|
| Aprobar idea | `content_ideas.status = client_approved` + INSERT `client_feedback` | Ninguno hasta `/confirm` | Ninguno |
| Editar copy/hashtags | `client_edited_copy` / `client_edited_hashtags` + INSERT `client_feedback` | Ninguno hasta `/confirm` | Ninguno |
| Rechazar idea | `client_rejected` + INSERT `client_feedback` | Idea excluida del fan-out | Ninguno |
| **Pedir variación** | `client_requested_variation` + INSERT `client_feedback` | 🔴 Ninguno — no hay handler de variación | 🔴 Ninguno — worker no se entera |
| Confirmar plan | Transición a `producing` + fan-out | Sí (ver §C.3) | Ninguno (ningún worker notificado) |

### C.8. Estado del plan al entrar/salir de Fase C

| Entrada | Salida (ruta happy) | Salida (ruta estancada) |
|---|---|---|
| `client_reviewing` | `client_approved → producing` en la misma transacción del confirm | Plan queda `client_reviewing` indefinidamente si cliente nunca confirma; sistema de `reminder_2/4/6_sent_at` existe en schema pero no se ha trazado consumer (❓ Tanda 3) |

### C.9. Rupturas detectadas en Fase C

- 🔴 **Fan-out sin plan-gate** ([§C.3](#c3-fan-out-sin-gate--impacto-facturación)). Impacto facturación real.
- 🔴 **`client_feedback` write-only** ([§C.4](#c4-client_feedback-tabla-write-only)). Feedback del cliente cae en un pozo.
- 🔴 **Stories no se re-renderizan al confirmar** ([§C.5](#c5-stories-no-se-rerenderizan-al-confirmar)). 5 stories/semana del plan Crecimiento son frágiles por diseño.
- 🔴 **Format mismatch produce handlers erróneos** ([§C.6](#c6-format-mismatch-ts--llm--checks)).
- 🔴 **`request_variation` sin handler** ([§C.2](#c2-patch-por-idea--acciones-del-cliente)). Botón muerto en UI.
- 🟠 **Plan `producing` sin transición automática a `calendar_ready`**. La transición requiere que `scheduling:auto_schedule_week` corra después — trazar en Tanda 3.
- 🟡 **Plan real con 3 posts en lugar de 4** — monitor, no bloqueante (ver Resumen ejecutivo).

---

## Contraste con modelo mental — Fase C (puntos 9-12)

| # | Punto del modelo mental | Estado | Detalle |
|---|---|---|---|
| 9 | Cliente recibe email con link al plan aprobado por worker | ✅ | `WeeklyPlanReadyEmail` enviado al transitar a `client_reviewing`. Link funcional a `/planificacion/[week_id]`. |
| 10 | Cliente aprueba, edita, rechaza o pide variación por idea | ⚠️🔴 | Aprobar/editar/rechazar ✅ funcionales. **Pedir variación** 🔴 no tiene efecto (§C.2). |
| 11 | Cliente confirma el plan → se lanza producción multimedia | ⚠️ | Sí lanza `generate_caption` + `generate_image`. Pero sin plan-gate (§C.3), con mapping de format roto para `'video'`/`'carrusel'`/`'story'` (§C.6), y sin tratar stories correctamente (§C.5). |
| 12 | El feedback escrito del cliente llega al worker para iterar | 🔴 | No. `client_feedback` es write-only (§C.4). El worker no tiene vista de comentarios del cliente. |

---

## Pendiente Tanda 3 (Fases D-E)

- Quién dispara `scheduling:auto_schedule_week` tras `/confirm` y cómo transita `producing → calendar_ready`.
- Fase D — handlers reales de `content:generate_image` y `content:generate_caption` con idea aprobada. Verificar que leen `client_edited_copy`/`client_edited_hashtags` (confirm los mete en `input.final_copy`).
- Fase E — cómo se cruza `content_ideas` con `posts` y `proposals`. ¿`content_ideas.post_id` se rellena? ¿`proposal_id` se alimenta al producir?
- Validar handler real del flow `content_kind:'story'`: ¿hay un handler específico o se asume que `rendered_image_url` de Fase A es el output final?
- Trazar si el sistema de recordatorios `reminder_2/4/6_sent_at` de `weekly_plans` tiene consumer (probablemente cron a trazar).
- `/planificacion/[week_id]/_components` — `CalendarView`, `PlanSidebar`, `RescheduleModal`, `RetouchModal`.

## Preguntas abiertas — acumuladas

- ❓ Schema real de `weekly_plans`, `content_ideas`, `proposals`, `client_feedback` (no en repo).
- ❓ RLS de todas las tablas anteriores.
- ❓ ¿Quién dispara `scheduling:auto_schedule_week` (step 6 de `weekly_pipeline`) y cómo se coordina con `client_approved`?
- ❓ ¿`proposals` se sigue alimentando hoy? (Requiere query: `SELECT COUNT(*), MAX(created_at) FROM proposals` en producción.)
- ❓ ¿Es intencional que confirm use `queueJob` directo saltando el orchestrator, o es un olvido? (afecta §C.3.)
- ❓ ¿`client_feedback` fue pensada para alimentar a algún agente futuro? (hay un campo `new_value.client_edited_*` sugerente, pero sin consumer.)
- ❓ **Duplicación de handler detectada:** `content:generate_ideas` ([handlers/backend.ts](../src/lib/agents/handlers/backend.ts) → `runIdeasAgent` del workspace `backend/`) y `strategy:generate_ideas` ([handlers/strategy.ts](../src/lib/agents/handlers/strategy.ts) → `generateIdeasHandler` local) coexisten en el registry. El flujo semanal usa el `strategy:` y tras el commit `9a0f4c9` ese es el que consume `brand_material`. El `content:` se mantiene referenciado en [api/cron/process-agent-replies/route.ts:128](../src/app/api/cron/process-agent-replies/route.ts#L128) y [worker/agents/status/route.ts:16](../src/app/api/worker/agents/status/route.ts#L16). Requiere decisión de producto: ¿se matan ambos duplicados y se unifica, o se dejan como flujos paralelos? Análogo al caso `proposals` de [§A.5](#a5-flujo-paralelo-proposals--posible-legacy).
