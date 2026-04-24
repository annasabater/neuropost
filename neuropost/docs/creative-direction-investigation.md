# Creative direction system — codebase investigation

**Fecha:** 2026-04-24
**Alcance:** read-only. Nada modificado.
**Objetivo:** mapear el código actual relacionado con brand kit, stories
(plan + render), calendario de efemérides y feedback loop, como base para
las próximas 5 fases de trabajo.

Convención: todas las referencias se dan como `archivo:línea`. Rutas
absolutas cuando aparecen fuera de `neuropost/`; dentro del proyecto
Next.js la raíz implícita es `neuropost/`.

---

## 1. Mapa del pipeline actual de stories

### 1.1. Entry point de `planStoriesHandler`

Caller único encontrado:

- `src/lib/agents/strategy/plan-week.ts:255` — invocado desde
  `planWeekHandler` cuando el plan semanal incluye stories. No hay otros
  callers en `src/` ni en `tests/` ni en `scripts/`.

Params con los que se invoca (`plan-week.ts:255-265`):

```
{
  brand_id,                           // job.brand_id
  week_id:                  planId,
  brand,                              // objeto Brand completo
  brand_material:           (material ?? []).map(normalizeMaterial),
  stories_per_week:         storiesToGenerate,         // quota − ya creadas
  stories_templates_enabled: templatesEnabled,         // string[] de template_ids
  startPosition:            parsedIdeas.length + storiesAlready,
  inspiration_refs:         inspirationRefs ?? [],    // de inspiration_references
  media_refs:               (mediaRefs ?? []) as { url: string }[], // de media_library
}
```

Nota clave: `plan-week.ts:221-233` hace dos SELECT en paralelo a
`inspiration_references` (filtradas por `is_saved=true` y thumbnail_url
no null) y `media_library` (`type='image'`) antes de llamar al handler.

### 1.2. Interior de `planStoriesHandler`

Firma: `src/lib/agents/stories/plan-stories.ts:279`.

Flujo secuencial:

1. **Guard** — `stories_per_week <= 0` → return `[]` (plan-stories.ts:285).
2. **buildSlots()** — `plan-stories.ts:287` → delega a `buildSlots()`
   definido en `plan-stories.ts:219`. Devuelve `StorySlot[]`. Lógica
   exacta:
   - `plan-stories.ts:224-227` — schedule: busca el primer material con
     `category === 'schedule'` y `active === true`. Como máximo uno.
   - `plan-stories.ts:230-237` — promo: filtra `category === 'promo'`,
     `active === true`, pasa por `isActiveNow(m, now)` (respeta
     `active_from`/`active_to`), hace `.slice(0, 3)` → máximo 3 promos.
   - `plan-stories.ts:240-263` — round-robin sobre `quote`, `data`,
     `free`. Se mapean a `story_type`: `quote → 'quote'`,
     `data → 'data'`, `free → 'custom'`. Pools vacíos se eliminan de
     la rotación (`plan-stories.ts:258-260`). Fallback: si
     `typeQueue` queda vacío, emite slots tipo `'quote'` sin source.
3. **generateStoryCreativeContent()** — `plan-stories.ts:290` → función
   definida en `plan-stories.ts:106`. Construye
   `StorySlotInput[]` con `buildCopyFromSource()` para preservar verbatim
   de schedule (`plan-stories.ts:109-115`). Invoca
   `buildStoryCreativeBatchPrompt(brand, slotInputs)` en
   `plan-stories.ts:117`. Llama a Claude Haiku
   (`claude-haiku-4-5-20251001`) en `plan-stories.ts:119-122`. Parsea
   respuesta JSON (`plan-stories.ts:124-153`), limpia backticks
   (`plan-stories.ts:127-131`). Fallback a `FALLBACK_QUOTES`
   (`plan-stories.ts:3-14`) si la respuesta vacía o falla
   (`plan-stories.ts:157-163`).
4. **Construcción del pool de imágenes** — `plan-stories.ts:292-298`.
   Fusiona `inspiration_refs[].thumbnail_url` + `media_refs[].url` y
   hace shuffle Fisher-Yates (`plan-stories.ts:268-275`).
5. **Asignación por cycling** — `plan-stories.ts:305`:
   `allImages[idx % allImages.length]`. Si no hay imagen y hay prompt →
   `image_generation_prompt` se rellena para render posterior
   (`plan-stories.ts:307`).
6. **Construcción de `StoryIdeaRow`** — `plan-stories.ts:302-330`. El
   handler **sólo devuelve** el array. No hace INSERT.

### 1.3. INSERT en `content_ideas`

El INSERT lo hace `plan-week.ts:268-271`, no el handler de stories. La
forma de la fila está fijada por `StoryIdeaRow` en
`plan-stories.ts:309-329`.

Columnas rellenadas (20 campos):

| Columna | Valor |
|---|---|
| `week_id` | planId |
| `brand_id` | brand.id |
| `position` | startPosition + idx |
| `format` | `'story'` |
| `angle` | slot.type (`schedule`/`promo`/`quote`/`data`/`custom`) |
| `hook` | `null` (P17: deprecated REPLICATE encoding) |
| `image_generation_prompt` | `creative.imagePrompt` si no hay imagen; si no, `null` |
| `copy_draft` | `creative.copy` o `null` |
| `hashtags` | `null` |
| `suggested_asset_url` | URL del pool o `null` |
| `suggested_asset_id` | `null` |
| `category_id` | `null` |
| `agent_output_id` | `null` |
| `status` | `'pending'` |
| `content_kind` | `'story'` |
| `story_type` | slot.type |
| `template_id` | `stories_templates_enabled[idx % K]` o `null` |
| `rendered_image_url` | `null` |
| `generation_fallback` | `creative.isFallback` |

Columnas que **quedan null** tras el insert: `hook`, `hashtags`,
`suggested_asset_id`, `category_id`, `agent_output_id`,
`rendered_image_url`, y a menudo `image_generation_prompt` (si había
foto). Ver nota en 9.3 sobre `original_idea_id` y otros campos que
puedan quedar a su default.

### 1.4. Trigger del render

Dos disparadores encontrados:

- **Fire-and-forget desde plan-week.ts:285-298**, inmediatamente tras
  marcar `render_status='pending_render'` (`plan-week.ts:280-283`). El
  POST no espera respuesta: `Promise.allSettled(renderFetches).catch(() => {})`
  (`plan-week.ts:298`).
- **Cron de reconciliación**:
  `src/app/api/cron/reconcile-renders/route.ts` — corre cada 2 minutos
  (schedule en `vercel.json`). Reintenta ideas en estado
  `pending_render`, `rendering` con `render_started_at > 5min`, o
  `render_failed` con `render_attempts < 3`. Hace POST fire-and-forget
  con `INTERNAL_RENDER_TOKEN`. `maxDuration = 30` segundos.

Ambos caminos acaban en el mismo endpoint POST.

### 1.5. Endpoint `/api/render/story/[idea_id]`

Archivo: `src/app/api/render/story/[idea_id]/route.ts`.

Lectura de `content_ideas`: `SELECT *` por `id` (una sola fila). Campos
que consume:

- **Claim atómico**: `render_status`, `render_started_at`,
  `render_attempts` (para idempotencia).
- **Validación**: `id`, `content_kind`, `brand_id`, `template_id`.
- **Decisión de layout**:
  `layoutName = template.layout_config?.layout ?? 'flexible'`. El
  `template` se busca en la tabla `story_templates` usando
  `idea.template_id`.
- **Decisión de imagen**:
  1. `suggested_asset_url` si ya existe.
  2. Si no, `image_generation_prompt` (P17). Se manda a Replicate (Flux
     Dev) en `generateImageSync()`, se sube al bucket
     `stories-rendered` de Supabase Storage y se persiste la URL en
     `suggested_asset_url`.
  3. Fallback deprecated: `hook.startsWith('REPLICATE:')` (legado; no
     se genera nuevo código que lo rellene).
- Finalmente invoca `renderStory({ layoutName, idea, brand, bgImageUrl })`
  y persiste el PNG en `rendered_image_url`, moviendo
  `render_status='rendered'`.

### 1.6. `render.tsx` — los 12 layouts

Archivo: `src/lib/stories/render.tsx`. Dispatcher en el switch
`src/lib/stories/render.tsx:582-598`. `RenderCtx` construido en
`render.tsx:633-640` con campos: `copy`, `brandName`, `primary`,
`secondary`, `logoUrl`, `bgImageUrl`.

| # | Layout | Función (línea) | Campos de RenderCtx usados | Produce visualmente |
|---|---|---|---|---|
| 1 | `centered` | `LayoutCentered` (render.tsx:71) | copy, brandName, primary, logoUrl | Fondo primary, quote grande centrada, logo top-right, brand name bottom |
| 2 | `minimal` | `LayoutMinimal` (render.tsx:108) | copy, brandName, primary | Fondo blanco, barra lateral primary 10px, quote condensada, brand name bottom-right |
| 3 | `table` | `LayoutTable` (render.tsx:136) | copy, brandName, primary, secondary | Fondo blanco, horario semanal en filas (header "NUESTRO HORARIO") |
| 4 | `hero` | `LayoutHero` (render.tsx:184) | copy, brandName, primary | Fondo primary, featured first day/hours gigante, resto semana compacto |
| 5 | `banner` | `LayoutBanner` (render.tsx:243) | copy, brandName, primary, secondary | Superior 58% blanco (title + desc), inferior 42% primary (brand + CTA) |
| 6 | `urgent` | `LayoutUrgent` (render.tsx:284) | copy, brandName, primary | Fondo oscuro `#0f172a`, strips primary arriba/abajo, title primary, divider blanco |
| 7 | `stat` | `LayoutStat` (render.tsx:336) | copy, brandName, primary, secondary | Fondo blanco, número gigante primary, contexto secondary, accent line top |
| 8 | `tagline` | `LayoutTagline` (render.tsx:378) | copy, brandName, primary | Fondo primary, tagline centrado blanco, divider horizontal |
| 9 | `overlay` | `LayoutOverlay` (render.tsx:408) | copy, brandName, primary, secondary | Fondo primary con dark overlay, texto blanco inferior |
| 10 | `flexible` | `LayoutFlexible` (render.tsx:441) | copy, brandName, primary, secondary | Fondo `#f8fafc`, border izq primary, párrafo con header branded. Default fallback |
| 11 | `photo_overlay` | `LayoutPhotoOverlay` (render.tsx:492) | copy, brandName, primary, bgImageUrl | Full-bleed image + dark overlay, strip top primary, texto blanco centrado |
| 12 | `photo_schedule` | `LayoutPhotoSchedule` (render.tsx:524) | copy, brandName, primary, bgImageUrl | Full-bleed image + overlay oscuro, header "HORARIO", tabla blanca |

Switcheo automático cuando hay imagen (`render.tsx:626-631`):

- Si `bgImageUrl` existe y layout es `table` o `hero` → `photo_schedule`.
- Si `bgImageUrl` existe y layout es cualquier otro → `photo_overlay`.

Es decir: los 10 primeros layouts son "text-first" y, cuando hay foto,
se sustituyen por uno de los 2 photo-layouts. **Hoy sólo `table`/`hero`
tienen un equivalente photo_* dedicado — los otros 8 colapsan todos en
`photo_overlay` cuando hay imagen.** Esto es relevante para cualquier
fase que quiera más variedad visual con fotos.

### Diagrama resumen

```
cron/plan-week trigger
        │
        ▼
plan-week.ts:255  planStoriesHandler({ brand_material, inspiration_refs, media_refs, ... })
        │
        ▼
plan-stories.ts:287  buildSlots()           ── schedule × 1 / promo × ≤3 / round-robin quote+data+free
plan-stories.ts:290  generateStoryCreativeContent()
                         │  Claude haiku 4.5 (batch, max_tokens 2000)
                         │  fallback: FALLBACK_QUOTES
                         ▼
plan-stories.ts:293  allImages = shuffle(inspiration_refs ∪ media_refs)
plan-stories.ts:302  map → StoryIdeaRow[]
        │
        ▼  (retorna — no INSERT)
plan-week.ts:268  db.from('content_ideas').insert(storyRows)
plan-week.ts:280  update render_status='pending_render'
plan-week.ts:288  fire-and-forget POST /api/render/story/{id}   ─── cron/reconcile-renders */2 min
        │                                                              retries (attempts < 3)
        ▼
route.ts  load idea + template (layout_config.layout ?? 'flexible')
route.ts  if !suggested_asset_url && image_generation_prompt
              → Replicate flux-dev → upload stories-rendered bucket
route.ts  renderStory({ layoutName, idea, brand, bgImageUrl })
        │
        ▼
render.tsx:582  buildJSX(layout, ctx)   ── 12 layouts, auto-switch a photo_* si hay bgImage
render.tsx:644  ImageResponse (satori) + fonts Barlow/Barlow Condensed
        │
        ▼
update rendered_image_url, render_status='rendered'
```

---

## 2. Estado del brand kit actual

### 2.1. Columnas de `brands` relevantes para dirección creativa

Fuente principal: `supabase/schema.sql:10-35` (CREATE TABLE original).
Columnas ampliadas por migraciones posteriores listadas aparte.

| Columna | Tipo | Default | Nullable | Origen | Uso en plan-stories / prompts / render |
|---|---|---|---|---|---|
| `name` | text | — | NO | schema.sql:13 | prompts.ts:47 (`Negocio: ${brand.name}`); render.tsx:635 (brandName) |
| `sector` | text | — | SÍ | schema.sql:14 | prompts.ts:42, 48, 58 |
| `tone` | text | — | SÍ | schema.sql:15 | prompts.ts:43 (mapeo TONE_LABELS en prompts.ts:16-21) |
| `colors` | jsonb | — | SÍ | schema.sql:16 | render.tsx:610, 636-637 (`colors.primary` fallback `#0F766E`; `colors.secondary` fallback `#374151`). Estructura: `{primary, secondary, accent?}` |
| `fonts` | jsonb | — | SÍ | schema.sql:17 | **No se lee** en plan-stories / prompts / render. Ver 5.3 |
| `slogans` | text[] | '{}' | NO (default) | schema.sql:18 | prompts.ts:54 (`slice(0,3).join(' / ')`) |
| `hashtags` | text[] | '{}' | NO (default) | schema.sql:19 | No se lee en stories pipeline |
| `location` | text | — | SÍ | schema.sql:20 | prompts.ts:49 (condicional) |
| `services` | text[] | '{}' | NO (default) | schema.sql:21 | prompts.ts:53 (`slice(0,6).join(', ')`) |
| `faq` | jsonb | — | SÍ | schema.sql:22 | No se lee en stories pipeline |
| `brand_voice_doc` | text | — | SÍ | schema.sql:23 | prompts.ts:55 (`slice(0, 400)`) |
| `publish_mode` | text | 'manual' | NO | schema.sql:29 | No afecta dirección creativa directamente |
| `rules` | jsonb | — | SÍ | schema.sql:30 | health-score.ts consulta `rules.forbiddenWords`, `rules.language`, `rules.emojiUse` |
| `plan` | text | 'starter' | NO | schema.sql:31 | Afecta quotas, no creatividad |

Añadidas por migraciones (no están en schema.sql pero sí en DB):

- `logo_url` (text, NULL) — introducida en
  `supabase/migrations/20260421_sprint12_render_columns.sql`. Leída en
  `render.tsx:638` con cast inseguro
  `(brand as unknown as Record<string, unknown>).logo_url`.
- `visual_style` (text, NULL) — leída en `prompts.ts:44` mapeada por
  `VISUAL_STYLE_LABELS` (prompts.ts:23-32: `creative`, `elegant`, `warm`,
  `dynamic`, `editorial`, `dark`, `fresh`, `vintage`). **DESCONOCIDO**
  qué migración la añadió — no aparece en la migración de render
  columns. Es muy probable que exista en DB pero que la migración esté
  en otro snapshot o fuera del repo.
- `description` (text, NULL) — leída en `prompts.ts:52`. Misma duda: no
  hay migración clara.
- `calendar_events_generated_at` (timestamptz, NULL) — se escribe en
  `src/lib/agents/scheduling/detect-holidays.ts:199`. **DESCONOCIDO**
  qué migración la añadió.

> ⚠️ Hay **drift** entre `schema.sql` y la DB viva. Varias columnas
> claves para la dirección creativa (`visual_style`, `description`,
> `logo_url`, `calendar_events_generated_at`) se usan desde código pero
> no están todas en `schema.sql` ni agrupadas en una migración
> localizable. Marcarlo como deuda técnica: cualquier fase futura
> debería consolidar el schema canónico antes de añadir nuevas
> columnas.

### 2.2. Componentes en `src/components/brand-kit/`

Inventario (una línea por archivo):

- `BrandHealthScore.tsx` — muestra porcentaje de completitud + lista de
  items faltantes. Sólo lectura.
- `BrandKitActivityFeed.tsx` — feed de actividad reciente del brand
  kit, link a `/brand-kit/history`. Sólo lectura.
- `BrandKitEditor.tsx` — **editor principal**, 9 secciones (detalle en
  2.3).
- `BrandKitHeader.tsx` — cabecera: título "Brand kit", plan label, menú
  de acciones. No edita.
- `BrandKitSummaryGrid.tsx` — grid con 3 cards (Identity, Communication,
  Publication) + Material hero. No edita.
- `CommunicationCard.tsx` — resumen de `tone`, hashtags, reglas de
  palabras, idioma, uso de emojis. Sólo lectura.
- `IdentityCard.tsx` — resumen: nombre, sector, ubicación,
  `visual_style`, swatches de colores. Sólo lectura.
- `MaterialDeMarcaHero.tsx` — hero con `itemCount`, `lastUpdatedAt` de
  `brand_material`, CTA al editor. Sólo lectura.
- `PublicationCard.tsx` — `publish_mode`, `contentRulesCount`,
  `postsPerWeek`, `preferredDays`. Sólo lectura.

### 2.3. `BrandKitEditor.tsx` (el moderno, en `components/brand-kit/`)

Tiene **9 pestañas** definidas como string union en la cabecera
(`src/components/brand-kit/BrandKitEditor.tsx` secciones enumeradas en
el componente):

1. `basics` — name, sector, location, brand_voice_doc, rules
2. `visual` — `visual_style`
3. `tone` — `tone`
4. `colors` — `colors.primary`, `colors.secondary`, `colors.accent`
5. `hashtags` — `hashtags[]`, `slogans[]`, rules subset
6. `voice` — `brand_voice_doc`, rules subset
7. `publish` — `publish_mode`
8. `rules` — `rules.noPublishDays`, `rules.forbiddenWords`, etc.
9. `preferences` — `rules.preferences` (sub-objeto)

**Save**: todas las secciones llaman a `PATCH /api/brands` (mismo
endpoint para todo). El endpoint ruta:
`src/app/api/brands/route.ts` (ver 2.3 caveat abajo).

### 2.3bis. Editor legacy `src/components/brand/BrandKitEditor.tsx`

Existe una **segunda** versión legacy en
`src/components/brand/BrandKitEditor.tsx`. Es más minimalista: edita
tone, colors, fonts (heading/body con default
`Cabinet Grotesk`/`Literata`), slogans, hashtags, `brand_voice_doc`.
Aún está **en uso**: importado desde
`src/app/(dashboard)/brand-kit/page.tsx`. Hay **duplicidad real** entre
`components/brand-kit/` (9 secciones) y `components/brand/` (legacy).
Esto es deuda técnica relevante para cualquier fase futura que añada
campos: hay que decidir si se consolidan o se mantiene doble.

### 2.4. Tablas con "brand" en el nombre

No tengo acceso a la DB viva para ejecutar
`information_schema.tables`. Basándome en migraciones y schema.sql:

- `brands` — tabla principal (schema.sql:10).
- `brand_material` — catálogo v2 (migración
  `supabase/migrations/20260420_sprint10_brand_material.sql`). Ver 6.1.

No hay tabla `brand_kit` separada en el código. La UI "brand kit"
trabaja enteramente sobre la tabla `brands` + `brand_material`.

> Para validar sobre DB viva: ejecutar
> `SELECT table_name FROM information_schema.tables WHERE
> table_schema='public' AND table_name ILIKE '%brand%';` en Supabase SQL
> Editor. Expectativa: `brands`, `brand_material`. Si aparece algo más,
> es potencial deuda o migración paralela.

### 2.5. Health score: qué considera "completo"

Fuente: `src/lib/brand/health-score.ts`. Puntos totales: 100.

| Criterio | Puntos | Condición | Línea |
|---|---|---|---|
| datos básicos | 15 | `name && sector && location` | health-score.ts:25 |
| logo + colors | 15 | `logo_url && colors.primary && colors.secondary` (7 si solo uno) | health-score.ts:33-36 |
| `visual_style` | 10 | presente | health-score.ts:44 |
| `tone` | 10 | presente | health-score.ts:51 |
| hashtags ≥ 3 | 10 | `hashtags.length ≥ 3` | health-score.ts:58 |
| forbiddenWords ≥ 1 | 10 | `rules.forbiddenWords.length ≥ 1` | health-score.ts:65 |
| language | 5 | `rules.language` | health-score.ts:73 |
| emojiUse | 5 | `rules.emojiUse` | health-score.ts:81 |
| contentRulesCount ≥ 1 | 10 | `≥ 1` | health-score.ts:88 |
| materialCount ≥ 5 | 10 | filas activas en `brand_material ≥ 5` | health-score.ts:95 |

Implicación para la Fase 1 (brand kit extendido): el cliente hoy ve
"100%" sin haber rellenado `brand_voice_doc`, `services`, `slogans`,
`description`, etc. El scoring ignora varios campos que el prompt sí
consume. Cualquier nuevo campo de dirección creativa
(`aesthetic_preset`, `realism_level`, etc.) tendrá que reevaluar la
rúbrica, porque hoy ya está desalineada con lo que realmente consume el
pipeline.

---

## 3. Sistema de calendario / efemérides existente

### 3.1 – 3.2. Grep y archivos relevantes

Archivos encontrados:

- `src/lib/agents/scheduling/detect-holidays.ts` — handler principal.
- `src/app/api/cron/detect-holidays/route.ts` — trigger cron.
- `src/agents/SeasonalAgent.ts` — librería de contenido estacional
  (calcula fechas próximas + genera posts).
- `src/app/api/cron/seasonal-planner/route.ts` — cron que genera posts
  estacionales automáticamente.
- `src/app/api/agents/seasonal/upcoming/route.ts` — API consumida por
  dashboard.
- `src/app/api/agents/seasonal/generate/route.ts` — API para generar
  contenido de una fecha específica.
- `supabase/calendar_holidays.sql` — esquema canónico (no está bajo
  `migrations/`, vive suelto en `supabase/`).

Términos buscados: `calendar`, `festivo`, `holiday`, `ephemeri`,
`festivity`, `diada`, `santoral`. Todos los hits relevantes acaban en
estos mismos archivos.

### 3.3. Tabla `calendar_events`

**EXISTE.** Fuente: `supabase/calendar_holidays.sql:11-30` (está
fuera de `supabase/migrations/`, pero es parte del repo). Schema:

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title                  text NOT NULL,
  date                   date NOT NULL,
  type                   text NOT NULL DEFAULT 'holiday',
    -- 'holiday' | 'cultural' | 'commercial' | 'local' | 'awareness'
  description            text,
  relevance              text NOT NULL DEFAULT 'medium',
    -- 'high' | 'medium' | 'low'
  suggested_content_idea text,
  country                text,
  region                 text,
  city                   text,
  source                 text NOT NULL DEFAULT 'agent',  -- 'agent' | 'manual'
  year                   int,
  created_at             timestamptz DEFAULT now(),
  UNIQUE (brand_id, date, title)
);

CREATE INDEX idx_calendar_events_brand_date ON calendar_events(brand_id, date);
CREATE INDEX idx_calendar_events_brand_year ON calendar_events(brand_id, year);
```

`calendar_events_generated_at` se SETea en
`src/lib/agents/scheduling/detect-holidays.ts:199`:

```
await db.from('brands').update({
  calendar_events_generated_at: new Date().toISOString()
}).eq('id', brandId);
```

### 3.4. Sample real de SportArea (`e8dc77ef-8371-4765-a90c-c7108733f791`)

**No ejecutado** — investigación read-only sin acceso a Supabase en
este entorno. Para validar, ejecutar:

```sql
SELECT title, date, type, relevance, suggested_content_idea, country, region, city
FROM calendar_events
WHERE brand_id = 'e8dc77ef-8371-4765-a90c-c7108733f791'
ORDER BY date
LIMIT 5;
```

Queda como **DESCONOCIDO — requiere ejecución en Supabase**.

### 3.5. Flujo de generación

1. **Trigger**: cron `detect-holidays`
   (`src/app/api/cron/detect-holidays/route.ts`). Según `vercel.json`
   (leer para confirmar schedule exacto): primer día de mes 06:00 UTC.
   Prioriza brands con `location IS NOT NULL` y
   `calendar_events_generated_at` NULL o > 60 días.
2. Encola job `detect_holidays` por brand y año en `agent_jobs`
   (`route.ts:62-75`). Año actual + siguiente.
3. El job lo procesa `detectHolidaysHandler` en
   `src/lib/agents/scheduling/detect-holidays.ts`. Prompt del sistema
   en `detect-holidays.ts:24-62` (paráfrasis):

   > Experto en calendarios festivos mundiales. Genera lista
   > exhaustiva para una ubicación. Incluye: festivos nacionales,
   > regionales/autonómicos, fiestas locales, fechas comerciales (San
   > Valentín, Black Friday, etc.), días de concienciación. Devuelve
   > JSON con `title`, `date (YYYY-MM-DD)`, `type`, `relevance`,
   > `description`, `suggested_content_idea`.

4. Modelo: `claude-haiku-4-5-20251001`, max_tokens ~1200.
5. UPSERT en `calendar_events` con `UNIQUE (brand_id, date, title)`.
6. Marca `brands.calendar_events_generated_at = now()` (línea 199).

`SeasonalAgent.ts` es un **lib**, no un agente con job en cola.
Funciones exportadas:

- `getUpcomingDatesForBrand(dates, sector, daysAhead=35)` — filtra y
  ordena próximos eventos relevantes.
- `generateSeasonalContent(input)` — llama a Claude Haiku con contexto
  de brand (tono, voz, forbiddenWords, etc.) y genera
  `{caption, hashtags, visualIdea, offerSuggestion, publishDate,
  format, alternativeCaption}`.

### 3.6. ¿`plan-week.ts` lee el calendario?

**NO LO LEE.** Grep `calendar_events`, `seasonal_dates`,
`SeasonalAgent` en `src/lib/agents/strategy/plan-week.ts` → 0 hits.

El cron `seasonal-planner`
(`src/app/api/cron/seasonal-planner/route.ts`) genera posts estacionales
aparte y los inserta probablemente como `content_ideas` independientes
del pipeline semanal. **Son dos sistemas independientes.**

### 3.7. Para la Fase 3 (creative director)

> **Para la Fase 3 (creative director), podremos leer efemérides de la
> tabla `calendar_events`**, llamándola así:

```ts
const { data: upcomingEvents } = await db
  .from('calendar_events')
  .select('title, date, type, relevance, description, suggested_content_idea')
  .eq('brand_id', brand.id)
  .gte('date', weekStart)
  .lte('date', weekEnd)
  .order('relevance', { ascending: false })  // 'high' primero
  .order('date', { ascending: true });
```

Alternativa: usar `SeasonalAgent.getUpcomingDatesForBrand()` pero esa
función opera sobre `seasonal_dates`, tabla distinta (ver 3.1). Para
eventos ya generados por LLM con ubicación específica, `calendar_events`
es la fuente correcta. **Riesgo**: hay al menos dos tablas de
efemérides/fechas en el sistema (`calendar_events` vs
`seasonal_dates`) y no están claramente coordinadas. A resolver antes
de la Fase 4.

---

## 4. Sistema de feedback del cliente

### 4.1. Schema `client_feedback`

Fuente: `supabase/migrations/20260423_planning_fixes_fase1_client_feedback.sql:15-31`.

```sql
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id        uuid NOT NULL REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  idea_id        uuid NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  action         text NOT NULL,
  comment        text,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_feedback_action_check
    CHECK (action IN ('approve', 'edit', 'request_variation', 'reject'))
);
```

Índices: `(idea_id, created_at DESC)`, `(week_id, created_at DESC)`,
`(brand_id, created_at DESC)`. RLS habilitada.

### 4.2. Endpoints que INSERT

Único caller encontrado:
`src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts:96-107`.

```ts
await db.from('client_feedback').insert({
  week_id:        id,
  idea_id:        ideaId,
  brand_id:       plan.brand_id,
  action:         body.action,
  comment:        body.comment ?? null,
  previous_value: { status, copy_draft, hashtags, client_edited_copy, client_edited_hashtags },
  new_value:      { status: newStatus, client_edited_copy, client_edited_hashtags },
});
```

### 4.3. Valores de `action`

Enumerados literalmente en el CHECK constraint y usados en el endpoint:

- `approve` — cliente aprueba la idea tal cual.
- `edit` — cliente edita copy y/o hashtags.
- `request_variation` — cliente pide otra versión (va a regenerate-idea).
- `reject` — cliente descarta la idea.

### 4.4. Endpoints que SELECT

Único caller encontrado:
`src/lib/agents/strategy/regenerate-idea.ts:134-147` (función
`loadRecentFeedbacksBlock`):

```ts
const { data } = await db
  .from('client_feedback')
  .select('action, comment, created_at')
  .eq('brand_id', brandId)
  .not('comment', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);
```

Se usa para inyectar los últimos 5 comentarios (solo los que tienen
comentario) como contexto en el prompt de regeneración.

**No hay** dashboards, agregaciones, analytics, ni vistas en UI que
consuman `client_feedback`. Ningún componente React lo lee.

### 4.5. Datos disponibles para perfil de preferencias por brand

> **Para la Fase 5 (feedback loop), los datos disponibles para construir
> un perfil de preferencias por brand son:**
>
> - `action` — 4 categorías; útil para aggregados de rechazo/edición
>   por `story_type`, `layout`, `angle`.
> - `comment` — texto libre; señal más rica pero no estructurada (hay
>   que procesar con LLM para extraer patrones).
> - `previous_value` vs `new_value` (JSONB) — diff real entre lo que
>   se proponía y lo que el cliente quería. Permite aprender qué
>   partes del `copy_draft` se reescriben más; qué hashtags se
>   añaden/quitan.
> - Correlación con la `idea` vía `idea_id` → `content_ideas` (story_type,
>   layout via template_id, suggested_asset_url, etc.). Eso permite
>   detectar si un brand rechaza sistemáticamente ciertos layouts o
>   ciertos tipos de foto.
>
> **Señales que faltan hoy** y que habría que añadir para un loop
> robusto:
>
> - `rating` numérico o `tags` estructurados (ej: "demasiado
>   comercial", "foto no representa el negocio").
> - Señal a nivel de campo: qué concretamente cambió en copy (bag of
>   words diff hoy no existe explícito).
> - Feedback sobre `image_generation_prompt` específicamente (si el
>   cliente cambia la imagen, no se registra el motivo).
> - Atribución al campo del brand kit ("rechacé esto porque mi tono no
>   es X" → permitiría corregir `brand.tone` o `brand.voice_doc`).

---

## 5. Sistema de tipografías / fuentes actual

### 5.1. Carga de fonts en `render.tsx`

Función: `fetchBunnyFont(googleFamily, weight)` en `render.tsx:22-31`.

- Fetch a `https://fonts.googleapis.com/css?family=...:weight`.
- User-Agent spoofed a `Mozilla/5.0 (Linux; Android 2.3.6; Nexus S Build/GRK39F) AppleWebKit/533.1`
  para recibir TTF directo (satori no acepta WOFF2).
- Regex extrae URL de `fonts.gstatic.com` acabada en `.ttf`.
- Descarga la TTF como `ArrayBuffer`.

Fuentes cargadas hoy (hardcoded en `render.tsx:33-41`):

- **Barlow** (weight 700)
- **Barlow Condensed** (weight 900)

El nombre `fetchBunnyFont` es histórico — hoy apunta a Google Fonts, no
a Bunny CDN.

### 5.2. Soportar 8 fuentes distintas seleccionables

Cambios que requeriría (sólo diagnóstico):

1. `render.tsx:44 loadFonts()` hoy devuelve un objeto fijo
   `{ barlow, barlowCondensed }`. Habría que:
   - Recibir el par `{heading, body}` elegido por el brand.
   - Normalizar a identificadores de Google Fonts (validar lista
     whitelist para no romper con fuentes raras).
   - Cachear las TTF por nombre para no refetchar en cada render
     (cacheable per-region via Vercel Runtime Cache sería el patrón
     natural — `cacheLife` generoso, invalidar sólo si la lista de
     fuentes cambia).
2. `render.tsx:648-649` pasa explícitamente `name: 'Barlow'` y
   `'BarlowCondensed'` a `ImageResponse.fonts`. Los layouts los
   referencian por `fontFamily` hardcoded (ej: `LayoutCentered` usa
   'Barlow' en sus styles). Hay que **renombrar a roles semánticos**
   (`--heading-font` / `--body-font`) o inyectar los nombres
   dinámicamente, no por literal.
3. Licencias: Google Fonts OFL permite redistribuir TTF, pero si se
   quisiera soportar tipos comerciales (Cabinet Grotesk, Literata que
   ya aparecen como default en el editor legacy) haría falta revisar.
4. Fallback: satori no tolera bien fuentes faltantes. Convendría
   mantener siempre Barlow como fallback si la TTF elegida no carga.

### 5.3. Campo `brands.fonts`

- Tipo: `jsonb` (schema.sql:17).
- Estructura esperada: `{ heading: string, body: string }` (leída en
  `src/types/index.ts` como `BrandFonts`).
- **NO se lee hoy** en `plan-stories.ts`, `prompts.ts` ni `render.tsx`.
- **SÍ se edita** en `src/components/brand/BrandKitEditor.tsx` (editor
  legacy) con default `{ heading: 'Cabinet Grotesk', body: 'Literata' }`.

Resultado: hay un campo editable que el cliente cree que tiene efecto,
pero el render lo ignora. Es una **brecha UX** evidente y una señal de
deuda. Cualquier Fase 1 que prometa "elige tu tipografía" primero tiene
que conectar este campo con `render.tsx`.

---

## 6. Catálogo de materiales del brand

### 6.1. Schema `brand_material`

Fuente: `supabase/migrations/20260420_sprint10_brand_material.sql:3-16`.

```sql
CREATE TABLE IF NOT EXISTS public.brand_material (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category      text NOT NULL,
  content       jsonb NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  valid_until   timestamptz,
  display_order int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_material_category_check
    CHECK (category IN ('schedule','promo','data','quote','free'))
);
```

Columnas mencionadas por el tipo `BrandMaterialV2` en código pero **no**
en esta migración (posiblemente en migración adicional no localizada):
`active_from`, `active_to`, `priority`, `platforms`, `tags`,
`schedules[]`, `variants[]`. Tratar como **DESCONOCIDO — requiere
confirmación en DB viva**.

### 6.2. Categorías válidas

CHECK constraint + TypeScript (`src/types/index.ts` — `BrandMaterialCategory`):

```
'schedule' | 'promo' | 'data' | 'quote' | 'free'
```

### 6.3. Mapeo `category → story_type` en `buildSlots`

Archivo: `plan-stories.ts:219-266`.

| DB `category` | story_type emitido | Límite | Filtro extra |
|---|---|---|---|
| `schedule` | `schedule` | ≤ 1 | `active=true`, toma el primero |
| `promo` | `promo` | ≤ 3 | `active=true` + `isActiveNow(m, now)` (respeta `active_from`/`active_to`) |
| `quote` | `quote` | sin límite | `active=true` |
| `data` | `data` | sin límite | `active=true` |
| `free` | `custom` | sin límite | `active=true` |

Los tres últimos se rellenan por round-robin hasta completar
`stories_per_week`. Si un pool (ej: `quote`) se agota, sale de la
rotación (`plan-stories.ts:258-260`). Si todos los pools se agotan y
todavía quedan slots por llenar, los slots restantes se emiten como
`quote` sin source, y `generateStoryCreativeContent` genera una frase
con los FALLBACK_QUOTES si Claude falla.

### 6.4. Stories vs posts

- `brand_material` alimenta **ambos**. No hay categorías dedicadas
  exclusivas a stories o a posts.
- El handler de posts (`plan-week.ts` en su rama no-stories) consume
  los mismos materiales para generar `content_ideas` con
  `content_kind='post'`.
- El campo `platforms` referenciado en tipos pero ausente del schema
  sería el candidato natural para segmentar si alguna vez hiciera
  falta.

### 6.5. Sample real SportArea

**DESCONOCIDO** — requiere acceso a Supabase. Query sugerida:

```sql
SELECT category,
       content->>'title' AS title,
       LEFT(COALESCE(content->>'description', ''), 60) AS desc_preview,
       valid_until
FROM brand_material
WHERE brand_id = 'e8dc77ef-8371-4765-a90c-c7108733f791'
  AND active = true
ORDER BY category, display_order;
```

---

## 7. Pool de imágenes (media + inspiration)

### 7.1. `inspiration_references`

Schema canónico: `src/scripts/inspiration-schema.sql:2-17` (nota: vive
bajo `src/scripts/`, no `supabase/migrations/`, otra señal de drift).

```sql
CREATE TABLE inspiration_references (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id       uuid REFERENCES brands(id) ON DELETE CASCADE,
  type           text,                  -- 'url' | 'upload' | 'template'
  source_url     text,
  thumbnail_url  text,
  title          text,
  notes          text,
  sector         text,
  style_tags     text[],
  format         text,                  -- 'image' | 'reel' | 'carousel' | 'story'
  is_saved       boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);
```

Ampliaciones por migraciones posteriores
(`supabase/inspiration_references_prompts.sql` y
`supabase/migrations/20260420_unify_inspiration.sql`): columnas de
análisis (`analysis_status`, `hidden_prompt`, `slide_prompts`, etc.).

**Cómo se alimenta**:

- Inputs del cliente: upload manual desde UI (endpoints bajo
  `src/app/api/inspiration/`).
- Scraping / Telegram ingest: cubren la tabla **nueva**
  `inspiration_bank` (migración `20260418_inspiration_telegram.sql`),
  no directamente `inspiration_references`. La migración
  `20260420_unify_inspiration.sql` crea **una vista** que unifica
  `inspiration_references` (legacy) + `inspiration_bank` (nuevo) con un
  campo `source='legacy'|'bank'`. Punto importante: el plan-week.ts
  (`:221-227`) consulta la **tabla** `inspiration_references`, no la
  vista unificada, así que **no consume el inspiration_bank nuevo**.
  Deuda técnica relevante.

### 7.2. `media_library`

Schema canónico: `supabase/schema.sql:184-196`.

```sql
create table if not exists public.media_library (
  id           uuid primary key default uuid_generate_v4(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  storage_path text not null,
  url          text not null,
  type         text not null check (type in ('image', 'video')),
  mime_type    text,
  size_bytes   bigint,
  duration     real,
  width        integer,
  height       integer,
  created_at   timestamptz default now()
);
```

**SÍ existe** (correcciones a notas anteriores: está en `schema.sql`,
no en una migración datada). Se alimenta desde uploads del cliente a
Supabase Storage. Índices en `(brand_id)` y `(brand_id, type)`.

### 7.3. Merge en `plan-stories.ts`

`plan-stories.ts:292-298` — literal:

```ts
const allImages = shuffled([
  ...(params.inspiration_refs ?? [])
    .filter((r): r is InspirationRef & { thumbnail_url: string } => !!r.thumbnail_url)
    .map(r => r.thumbnail_url),
  ...(params.media_refs ?? []).map(r => r.url),
]);
```

- Orden pre-shuffle: inspiration primero, media library después.
- Shuffle Fisher-Yates: `shuffled()` en `plan-stories.ts:268-275`.
- Asignación cyclic en `plan-stories.ts:305`: cada story coge una
  imagen distinta. Si hay 5 imágenes y 3 stories, 3 imágenes se usan
  (sin repetir). Si hay 2 imágenes y 5 stories, se reparten con
  repetición.

### 7.4. Sample real de imágenes

**DESCONOCIDO** — sin DB viva. Queries sugeridas:

```sql
-- media_library
SELECT url FROM media_library
WHERE brand_id = 'e8dc77ef-8371-4765-a90c-c7108733f791' AND type='image'
LIMIT 5;

-- inspiration_references
SELECT thumbnail_url FROM inspiration_references
WHERE brand_id = 'e8dc77ef-8371-4765-a90c-c7108733f791' AND is_saved=true
LIMIT 5;
```

Si las URLs apuntan a `picsum.photos`, `unsplash.com` sin hashes reales
del cliente, o buckets `stories-placeholder-*`, se trata de
placeholders — marcar y corregir.

### 7.5. Metadatos disponibles para un director de arte

Campos útiles por tabla:

| Señal | inspiration_references | media_library | inspiration_bank (no consumido hoy) |
|---|---|---|---|
| descripción texto | `title`, `notes` | — | — |
| tags / estilo | `style_tags[]` | — | `tags[]`, `mood`, `category` |
| dimensiones | — | `width`, `height` | — |
| colores dominantes | — | — | `dominant_colors[]` |
| formato sugerido | `format` | `type` ('image'/'video') | `media_type` |
| origen / autor | `source_url` | `storage_path` | `source_url`, `source_platform` |
| prompt técnico | (via migración análisis) `hidden_prompt`, `slide_prompts` | — | `hidden_prompt`, `scene_prompts` |
| `alt_text` explícito | **NO EXISTE** | **NO EXISTE** | **NO EXISTE** |
| `orientation` | — | calculable de w/h | — |
| `author` | — | — | — |

Conclusión: hoy el pool llega a `plan-stories.ts` como **URLs
desnudas** — el handler pierde toda la metadata. Para que un creative
director pueda elegir foto con criterio, habría que:

1. Pasar los objetos completos, no sólo URLs, desde `plan-week.ts` al
   handler.
2. Normalizar los metadatos entre `inspiration_references`,
   `media_library`, e `inspiration_bank` (hoy están inconsistentes).
3. Considerar añadir `alt_text` y `orientation` (calculable) si se
   quiere que el director razone sobre composición.

---

## 8. Prompts actuales vs lo que necesita un director de arte

### 8.1. `buildStoryCreativeBatchPrompt` — contenido literal

Archivo: `src/lib/agents/stories/prompts.ts:42-86`. Template:

```
Eres un director creativo especialista en redes sociales para negocios del sector ${brand.sector ?? 'local'}.

MARCA:
${brandCtx}

TAREA: Para cada slot de historia de Instagram genera "copy" e "imagePrompt".

"copy" — texto breve en español (máx 15 palabras):
  - schedule: copia EXACTA del existingCopy (días y horas sin ningún cambio)
  - promo: texto promocional atractivo basado en existingCopy
  - quote/custom/data: frase auténtica y específica para este sector
    Dental: "Tu sonrisa habla antes de que digas nada.", "No esperes a que sea tarde.", "Una boca sana es tu mejor carta de presentación."
    Gym: "Cada repetición es un argumento contra las excusas.", "El dolor de hoy es el orgullo de mañana."
    Restaurante: "La mejor mesa es la que compartes.", "Cocina con alma para personas reales."

"imagePrompt" — prompt en INGLÉS para IA de imágenes (Flux Dev, fotorealista, sin texto en imagen, máx 70 palabras):
  Incluye: sujeto + estilo fotográfico + iluminación + mood. Adapta al sector con gran especificidad.
  Dental/schedule → "professional modern dental clinic reception, warm lighting, clean minimal, editorial photography, shallow depth of field"
  Dental/quote sonrisa → "extreme close-up perfect white teeth smiling, high contrast black and white, studio lighting, beauty photography"
  Dental/quote urgencia → "single tooth macro photography, dramatic side lighting, fine art healthcare concept, moody"
  Gym → "athletic person lifting weights, dramatic gym lighting, sweat, determination, cinematic, dark moody"
  Restaurante → "beautifully plated dish, natural side light, food photography, shallow bokeh, warm tones"

Slots:
${JSON.stringify(slots, null, 2)}

Responde ÚNICAMENTE con JSON array de ${slots.length} objetos:
[{ "copy": "...", "imagePrompt": "..." }, ...]
```

`brandCtx` (prompts.ts:46-56): bloque multilínea con `Negocio`,
`Sector`, `Ubicación` (cond.), `Tono` (mapeado), `Estilo visual`
(mapeado), `Descripción` (cond.), `Servicios` (slice 6),
`Eslóganes` (slice 3), `Voz de marca` (slice 400 chars).

### 8.2. Variables del brand que usa hoy

- `brand.name` (prompts.ts:47)
- `brand.sector` (prompts.ts:42, 48, 58)
- `brand.location` (prompts.ts:49, condicional)
- `brand.tone` → TONE_LABELS (prompts.ts:43)
- `brand.visual_style` → VISUAL_STYLE_LABELS (prompts.ts:44)
- `brand.description` (prompts.ts:52, condicional)
- `brand.services` (prompts.ts:53, slice 6)
- `brand.slogans` (prompts.ts:54, slice 3)
- `brand.brand_voice_doc` (prompts.ts:55, slice 400)

### 8.3. Qué NO usa (y un director de arte necesitaría)

Checklist del enunciado + hallazgos adicionales:

1. **`aesthetic_preset`** — NO existe como columna. CONFIRMADO.
2. **`realism_level`** — NO existe como columna. CONFIRMADO.
3. **Calendario de efemérides** — el prompt no recibe eventos próximos
   aunque la tabla `calendar_events` ya existe y tiene datos.
   CONFIRMADO.
4. **Imágenes disponibles** — el prompt no ve qué fotos hay en el
   pool. Hoy sólo recibe slots con `existingCopy`. CONFIRMADO.
   Consecuencia: imagen y copy se eligen en silos (imagen se shuffle-
   asigna, copy se genera con Claude sin saber qué foto le va a tocar).
5. **Feedback histórico del cliente** — no se inyecta contexto de
   `client_feedback`, aunque existe la tabla. CONFIRMADO.

Añado:

6. **Logo / colors / fonts** — el prompt no conoce la paleta. Si
   quisiéramos que recomiende layouts (ej: "este copy va mejor en
   `table` porque la paleta es clara"), necesitaría ver los colores.
7. **Layout catalog** — el prompt no sabe que existen 12 layouts ni
   cuál elegir. Hoy la selección es determinista via `template_id`
   asignado por round-robin, sin razonamiento creativo.
8. **`forbiddenWords` / `noPublishDays`** — el prompt ignora las
   reglas del brand. Riesgo de generar copy que viole restricciones.
9. **Hashtags** — el output no incluye hashtags (el schema los pone
   a `null`). Si el creative director debe decidir hashtags
   contextuales, hoy no tiene ese slot.
10. **`idea.position` / contexto del plan** — el prompt trata cada
    slot aisladamente. Un director real tendría en cuenta el plan
    completo para variedad (no 3 stories tipo quote seguidas con
    misma estética).
11. **Canal / plataforma** — el prompt asume Instagram story. Si
    alguna vez hay Reels, TikTok, etc., no está parametrizado.
12. **Tests**: `tests/brand-material/plan-stories-v2.test.ts`
    verifica verbatim del schedule. Si se reescribe el prompt, hay
    que preservar esa garantía (ver 9.2).

### 8.4. Modelo: Haiku 4.5 vs Sonnet

Hoy: `claude-haiku-4-5-20251001` (plan-stories.ts:119),
`max_tokens=2000`.

Argumentos para seguir con Haiku:

- Coste: ~5× más barato que Sonnet.
- Latencia: plan-stories se llama en el camino crítico de
  `plan-week`, que ya es largo. Un Haiku batch tarda ~2-3s; un Sonnet
  tarda 5-10s para el mismo prompt.
- Hoy el prompt es simple. Haiku lo resuelve bien.

Argumentos para considerar Sonnet en Fase 3:

- Un creative director necesita **razonar sobre múltiples inputs
  correlados** (calendario + catálogo de layouts + feedback
  histórico + pool de imágenes con metadatos). Haiku tiende a
  simplificar en prompts grandes.
- Selección de layout + imagen + copy coherente es una tarea
  multi-paso que se beneficia de pensamiento más estructurado.
- El volumen es bajo (stories_per_week ≤ ~10 por brand, batch
  semanal). Coste absoluto manejable.

Propuesta provisional (sin decidir): **mantener Haiku para copy
primario, usar Sonnet sólo para la fase de "dirección creativa"**
(selección de layout + racional creativo + elección de imagen). O
bien explorar **extended thinking** en Sonnet con budget limitado.
Decisión requiere un A/B comparando output real.

---

## 9. Riesgos y dependencias

### 9.1. Timeouts y fire-and-forget

- `planStoriesHandler` se ejecuta **dentro** del handler de
  `plan-week`, que es una función serverless (ruta
  `src/app/api/cron/...` o job-runner).
- `plan-week.ts` **no** declara `maxDuration` explícito en el archivo
  leído; por defecto Vercel asume el default de la plataforma (hoy
  300s; histórico 60-90s). Ver `vercel.json` y las routes de cron para
  confirmar.
- Crons que invocan plan-week: `agent-queue-runner` (ejecuta jobs),
  `detect-stuck-plans` (expira plans > 10 min en `generating`).
- **Si el creative director añade 1-2 llamadas Sonnet extra** al
  camino crítico, conviene:
  1. Validar `maxDuration` en la route que ejecuta jobs de planning.
  2. Considerar mover parte del trabajo a Workflow DevKit / step-based
     execution si se necesita resumibilidad y tolerancia a crash (es
     exactamente el tipo de orquestación multi-paso que el Workflow
     DevKit soporta).
  3. Mantener el trigger del render en fire-and-forget; no acoplar el
     render a la decisión creativa.

### 9.2. Tests que se invalidarían

- `tests/brand-material/plan-stories-v2.test.ts` — garantiza:
  1. **Verbatim del schedule** (byte-exact). Cualquier reescritura
     del prompt debe preservar esto o romperá el test.
  2. Mapeo category → story_type (promo → promo, free → custom,
     etc.).
  3. Lógica de `buildSlots` (schedule ≤ 1, promo ≤ 3, round-robin
     del resto).
  4. Filtro `isActiveNow` para promos.
- Si se introducen nuevos `story_type` o se cambia la semántica de
  slot.source, habrá que actualizar el test.
- **No hay** tests sobre `render.tsx` layouts, ni sobre el trigger
  del render, ni sobre la lógica de carga de fonts.

### 9.3. Consumidores downstream de `content_ideas`

Archivos que leen/escriben la tabla (grep `content_ideas`):

- `src/app/api/cron/reconcile-renders/route.ts` — lee
  `id, render_status, render_started_at, render_error, render_attempts`.
  Añadir layout_name nuevo NO rompe.
- `src/app/api/render/story/[idea_id]/route.ts` — lee `*`. Espera
  `copy_draft`, `suggested_asset_url`, `template_id`,
  `image_generation_prompt`, `hook` (legacy). Añadir columnas NO
  rompe; cambiar semántica de `template_id` (ej: pasar a guardar
  layout directamente) SÍ rompe.
- `src/lib/planning/weekly-plan-service.ts` — usa RPC
  `create_weekly_plan_atomic`. Los rowtypes que acepta la función
  Postgres son acoplamiento fuerte: añadir columnas nuevas requiere
  migración del RPC.
- `src/app/api/worker/weekly-plans/[id]/ideas/[ideaId]/route.ts` —
  modifica status. No toca campos creativos.
- `src/lib/agents/strategy/regenerate-idea.ts` — INSERT nueva idea
  con `original_idea_id` y UPDATE original a
  `status='replaced_by_variation'`.
- `src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts` —
  PATCH para approve/edit/reject. Escribe `client_edited_copy`,
  `client_edited_hashtags`.
- Varios componentes React del dashboard y del worker (no
  enumerados exhaustivamente, pero cualquier Grid o Card que renderice
  ideas).

**Riesgo concreto**: si se añade una columna `layout_name` explícita
en `content_ideas` para que el creative director la escriba, hay
que:

1. Migración SQL con default para filas existentes (o nullable).
2. Actualizar el RPC `create_weekly_plan_atomic` (acoplamiento
   fuerte).
3. Asegurar que el render endpoint usa el nuevo campo en vez de
   derivar de `template.layout_config`.
4. Reconciliar con `template_id` (hoy el layout está indirectamente
   en `story_templates.layout_config.layout`): decidir si el nuevo
   campo reemplaza `template_id` o convive.

### 9.4. Crons que tocan stories

De `vercel.json` y routes bajo `src/app/api/cron/`:

| Cron | Ruta | Schedule | Qué hace | Impacto si cambiamos stories |
|---|---|---|---|---|
| reconcile-renders | `/api/cron/reconcile-renders` | `*/2 * * * *` | Re-dispara renders stuck/failed (< 3 intentos) | Sensible a `render_status`, `render_attempts`, `render_started_at`. Añadir columnas no rompe; cambiar estados sí |
| detect-stuck-plans | `/api/cron/detect-stuck-plans` | `*/15 * * * *` | Expira plans `generating` > 10 min | No toca `content_ideas` directo. Si el creative director hace el plan más lento, puede disparar falsos positivos |
| detect-holidays | `/api/cron/detect-holidays` | mensual (01 06:00 UTC aprox) | Regenera `calendar_events` por brand | Dependency para Fase 3 (creative director) si consume efemérides |
| seasonal-planner | `/api/cron/seasonal-planner` | diario/horario (confirmar) | Genera posts estacionales aparte | Podría colisionar con creative director si ambos insertan ideas seasonal |
| agent-queue-runner | `/api/cron/agent-queue-runner` | `*/1 * * * *` | Ejecuta jobs `agent_jobs` (incluye `detect_holidays`, `plan_week`) | Core — si el creative director lo ralentiza, subir `maxDuration` |
| analyze-inspirations | `/api/cron/analyze-inspirations` | hourly | Analiza nuevas filas de inspiration_bank / inspiration_references | No toca stories directo, pero alimenta el pool |
| publish-scheduled | `/api/cron/publish-scheduled` | hourly | Publica posts al canal | No toca stories (stories actuales no auto-publish) |

---

## 10. Plan de fases ajustado al código real

### 10.1. Fase 1 — brand kit extendido

**Adaptaciones no previstas**:

- Hay **dos editores** en paralelo (`components/brand-kit/BrandKitEditor`
  con 9 pestañas y `components/brand/BrandKitEditor` legacy con 6
  campos, aún usado en `/brand-kit/page.tsx`). Añadir campos nuevos
  sin consolidar primero crea más deuda.
- Campos usados por el prompt (`description`, `visual_style`) no están
  claramente localizados en migraciones ni en `schema.sql`. Antes de
  añadir `aesthetic_preset` y `realism_level`, **reconstruir un
  schema canónico** de `brands` es prerequisito realista.
- `health-score.ts` puntúa hoy campos que el pipeline real NO usa, y
  no puntúa otros que SÍ usa. Reescribir la rúbrica en función del
  pipeline actual evita frustración del cliente ("100% y sale mal").

**Riesgos**:

- Editar `brands` con 25+ columnas + `rules` jsonb complejo: el endpoint
  PATCH `/api/brands` mezcla todo. Añadir 4-5 campos nuevos sin romper
  los existentes requiere test de regresión.
- Si Fase 1 conecta `brands.fonts` con render, impacto en licencias y
  en cache de TTF.

### 10.2. Fase 2 — catálogo de layouts

**Cómo encaja con los 12 existentes**:

- Los 12 están en un `switch` (render.tsx:582-598) con fallback a
  `flexible`. Añadir layouts es de bajo riesgo si se respeta el patrón:
  nueva función `LayoutX` + nuevo `case 'x'`.
- Atención al auto-switcheo `photo_*` en render.tsx:626-631: hoy sólo
  `table`/`hero` tienen gemelo photo. Añadir más layouts
  "text-first" que DEBAN tener gemelo photo implica ampliar ese
  mapeo o crear una tabla de "capabilities" por layout.
- El layout vive en `story_templates.layout_config.layout`. Añadir
  layouts nuevos requiere INSERT en `story_templates` del sistema (ver
  migración `20260421_sprint12_update_system_layouts.sql` como
  referencia de patrón).

**Patrón sugerido**:

1. Convertir el switch en un registry
   (`const LAYOUTS = { centered: LayoutCentered, ... }`).
2. Cada layout declara metadata (capabilities: `supportsImage`,
   `tonality`, `best_for_story_types`).
3. El creative director en Fase 3 razona sobre ese catálogo, no sobre
   strings mágicos.

### 10.3. Fase 3 — creative director

**Dónde insertarlo con mínimo impacto**:

- Hoy `generateStoryCreativeContent` (plan-stories.ts:106) es el único
  punto donde se decide copy e imagePrompt. La integración limpia:
  **reemplazar esa función** por `callCreativeDirector(...)` que
  devuelve el mismo `StoryCreativeResult[]` (copy + imagePrompt +
  isFallback) más un nuevo campo `chosenLayout` y `chosenImageUrl`.
- La función de asignación de imagen (plan-stories.ts:305) se mantiene
  pero acepta que, si el director ya eligió una imagen concreta, no
  hace cycling ciego.
- Esto permite **mantener la misma interfaz del handler** y el mismo
  INSERT en `plan-week.ts`.
- Modelo: **mantener Haiku para la fase batch simple**. Añadir **un
  segundo step con Sonnet** sólo para stories de alto valor (schedule
  + promo), Haiku para el relleno quote/data/custom. Control de
  coste y latencia.

**Consideración de orquestación**: si el creative director hace 3+
llamadas a LLM por semana + fetch de efemérides + análisis de feedback,
es un candidato natural a **Workflow DevKit** con steps retryables
(gather_context → decide_creative → decide_layout → decide_image). Hoy
todo sucede en un único handler serverless sin reanudación.

### 10.4. Fase 4 — efemérides

**Agente existente utilizable**:

- `calendar_events` ya tiene los datos (country / region / city,
  relevance, type, suggested_content_idea). Fase 4 **lee**, no
  **regenera**.
- El cron `detect-holidays` sigue siendo el único generador de la
  tabla. El creative director (Fase 3) **consume** la tabla.
- Si se quiere un "pack de grafismos vectoriales" separado (ej: SVG
  para Reyes, Black Friday), sería una tabla/bucket aparte
  (`holiday_assets` o similar) poblada manualmente o por un agente
  separado. **No es responsabilidad de Fase 3.**
- Conflicto latente: `SeasonalAgent.getUpcomingDatesForBrand` opera
  sobre `seasonal_dates` (otra tabla, distinta de `calendar_events`).
  Antes de Fase 4, **decidir cuál es la fuente canónica** y
  deprecar la otra, o documentar explícitamente los dos roles.

### 10.5. Fase 5 — feedback loop

**Datos que ya capturamos**:

- `action`, `comment`, `previous_value`, `new_value`, `idea_id`,
  `brand_id`. Suficiente para construir un perfil por brand a nivel
  agregado.
- Joins posibles con `content_ideas` para saber qué `story_type`,
  qué `template_id` (layout), qué `suggested_asset_url` se
  rechazaron más.

**Faltan**:

- Rating numérico o tags estructurados (ver 4.5).
- Atribución a campo del brand kit cuando el cliente edita
  (previous/new capturan el delta en la idea, no "porque mi tono real
  es otro").
- Señal de engagement real (likes/saves del post publicado) para
  cerrar el loop más allá de la aprobación del cliente.

**Prerequisito**: empezar a **leer `client_feedback` desde UI** (4.4
confirma que hoy sólo lo lee `regenerate-idea` para el prompt). Si
Fase 5 va a mostrar "Tu historial de preferencias", conviene
construir el endpoint + componente antes de añadir más datos.

---

## Resumen ejecutivo (TL;DR)

- Pipeline stories es **lineal y monolítico**: `plan-week` → 1 llamada
  Haiku batch → 12 layouts seleccionados por template round-robin →
  render via Replicate + satori. Punto único de entrada limpio para
  insertar un creative director.
- Brand kit tiene **drift real** entre schema.sql, migraciones y
  código. `schema.sql` no refleja todos los campos vivos. Antes de
  añadir, consolidar.
- **Dos editores brand kit** en paralelo, duplicación real.
- Calendario `calendar_events` **existe con LLM + localización** y
  **no se consume** por el pipeline de stories actualmente.
  Prerequisito limpio para Fase 3.
- `client_feedback` existe, se escribe, se lee **sólo** en
  `regenerate-idea`, nunca se muestra en UI. Datos suficientes para
  patrones, insuficientes para atribución fina.
- Fonts cargadas en render: Barlow + Barlow Condensed hardcoded.
  `brands.fonts` editable pero ignorado por el render. Brecha UX.
- Pool de imágenes: merge de `inspiration_references` +
  `media_library` con shuffle + cycling. El **inspiration_bank
  nuevo no se consume**. Metadata rica existe pero se pierde al
  pasar sólo URLs al handler.
- Prompt actual del batch: razonable, pero **no conoce calendario,
  layouts, imágenes disponibles, reglas del brand, ni feedback
  histórico**. Upgrade a "creative director" es un rework
  sustancial del prompt + posible cambio de modelo.
- Tests existentes protegen verbatim de schedule y lógica de
  `buildSlots`. Cualquier rework debe preservarlos.
- Crons afectados principalmente: `reconcile-renders`
  (`*/2 min`), `agent-queue-runner` (`*/1 min`). Latencia añadida
  por el creative director debe caber en el `maxDuration` del
  handler, o considerar Workflow DevKit.

---

## Preguntas abiertas para el usuario

Se listan las dudas críticas que bloquean decisiones de diseño y que
no pude resolver sin acceso a la DB viva o sin input del usuario:

1. **Schema canónico de `brands`**: ¿cuáles de las columnas
   `visual_style`, `description`, `calendar_events_generated_at`,
   `logo_url` están confirmadas en la DB de producción, y en qué
   migración se crearon? Si el repo no las tiene como migración
   versionada, ¿queremos consolidar primero?
2. **Doble editor del brand kit**
   (`components/brand-kit/BrandKitEditor.tsx` vs
   `components/brand/BrandKitEditor.tsx`): ¿eliminamos el legacy en
   Fase 1, o mantenemos ambos?
3. **Fuentes**: `brands.fonts` hoy es editable pero render lo ignora.
   ¿Queremos conectarlo en Fase 1? Si sí, ¿qué whitelist de Google
   Fonts (u otras) aceptamos? ¿Fallback si la TTF no se descarga?
4. **Catálogo de layouts**: ¿los 12 actuales son estables o Fase 2
   va a reescribir/renombrar? Si se renombran, hay migración del
   campo `story_templates.layout_config.layout` + re-render de plans
   antiguos.
5. **`template_id` vs layout directo en content_ideas**: ¿el creative
   director escribe `template_id` (indirecto) o añadimos una columna
   `chosen_layout`? Impacto en RPC `create_weekly_plan_atomic`.
6. **Modelo del creative director**: ¿sobrecoste aceptable si usamos
   Sonnet para la fase de dirección? ¿Qué volumen mensual estimamos?
7. **`calendar_events` vs `seasonal_dates`**: ¿cuál es la fuente
   canónica? Antes de Fase 4 conviene decidir y deprecar una, o
   documentar explícitamente dos roles.
8. **`inspiration_bank` unificado**: hoy `plan-week.ts` consulta
   sólo `inspiration_references`, ignorando `inspiration_bank`.
   ¿Migramos la query a la vista unificada antes de Fase 3, o
   mantenemos sólo inspiration_references?
9. **Sample real SportArea**: queries sugeridas en 3.4, 6.5, 7.4
   esperan ejecución en Supabase. ¿Las ejecutamos antes de la
   Fase 1, o aceptamos moverse con la especificación actual?
10. **Orquestación (Workflow DevKit)**: ¿estamos dispuestos a pasar
    parte del camino crítico a un workflow durable, o preferimos
    mantener todo en el handler serverless con `maxDuration`
    elevado?
11. **Test de verbatim (schedule)**: el rework del prompt mantendrá
    el verbatim por construcción (misma rama de lógica) o
    necesitamos añadir tests nuevos?
12. **Columnas extra en `content_ideas`**: ¿el creative director
    necesita persistir su racional ("por qué elegí este layout")
    para Fase 5? Si sí, añadir `creative_rationale jsonb` desde
    Fase 3 es más limpio que añadirlo tarde.
