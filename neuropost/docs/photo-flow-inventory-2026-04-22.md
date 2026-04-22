# Photo Flow Inventory — 2026-04-22

Exhaustive mapping of every image/video URL column in `posts`, who writes each one, who reads each one, and where they are stored. No fixes proposed — pure fact table.

> **Nota:** `docs/audit-flow-cliente-worker-2026-04-21.md` no existe todavía; este documento puede servir de base para ese audit.

---

## 1. Columnas de `posts` que contienen URL/path de imagen

### Tabla `posts`

| Columna | Tipo SQL | Migración origen | Nullable | Qué representa |
|---|---|---|---|---|
| `image_url` | `text` | `supabase/schema.sql` (base, pre-sprint) | SÍ | Fichero original subido por el cliente. **Contrato: nunca se sobreescribe por el pipeline de generación.** Para posts legacy con status `generated`/`pending` puede contener una imagen generada (backfill aplicado en 20260422_add_edited_image_url.sql). |
| `edited_image_url` | `text` | `20260422_add_edited_image_url.sql` | SÍ | Resultado del pipeline IA/worker. Escrita por el Replicate webhook, el handler local, y manual-upload. Cuando existe, es la imagen "actual" para el cliente. |
| `video_url` | `text` | `supabase/schema.sql` (base) | SÍ | URL del vídeo generado o subido manualmente (solo posts de formato `video`/`reel`). |
| `generated_images` | `text[]` | `supabase/schema.sql` (base) | SÍ | Array de URLs de imágenes aprobadas por validación IA. Representa el lote batch (multi-foto). Se llena en orden de aprobación, no necesariamente el orden de generación. |
| `generation_total` | `integer` | `supabase/schema.sql` (base) | NO (default 0) | Cuántas imágenes se solicitaron para el batch. Fijado al lanzar el job. |
| `generation_done` | `integer` | `supabase/schema.sql` (base) | NO (default 0) | Cuántas imágenes han pasado validación y entrado en `generated_images`. Incrementado atómicamente. |

### Tabla `post_revisions` (relacionada con posts vía FK)

| Columna | Tipo SQL | Migración origen | Nullable | Qué representa |
|---|---|---|---|---|
| `image_url` | `text` | `20260422_visual_strategist.sql` | SÍ | URL de la imagen de una revisión concreta. Inicialmente `null` cuando se crea el placeholder; rellenada cuando el job finaliza. |

### Tabla `content_ideas` (relacionada, no posts directamente)

| Columna | Tipo SQL | Migración origen | Nullable | Qué representa |
|---|---|---|---|---|
| `rendered_image_url` | `text` | `20260420_sprint10_content_ideas_columns.sql` | SÍ | Imagen renderizada de una historia/idea de contenido. Escrita por el endpoint `/api/render/story/[idea_id]`. No forma parte del flujo principal de posts. |

---

## 2. Writers — qué código escribe en cada columna

### 2.1 `posts.image_url`

| Archivo:línea | Operación | Condición / Trigger |
|---|---|---|
| [src/app/(dashboard)/posts/new/page.tsx:165](src/app/(dashboard)/posts/new/page.tsx#L165) | INSERT `posts` (via POST `/api/posts`) | Cliente crea post nuevo; primer media seleccionado (`form.selectedMedia[0]?.url`) |
| [src/app/(dashboard)/posts/new/page.tsx:195](src/app/(dashboard)/posts/new/page.tsx#L195) | INSERT `posts` (carrusel) | Cliente crea carrusel; `media?.url` para cada foto |
| [src/app/api/worker/posts/route.ts:146](src/app/api/worker/posts/route.ts#L146) | UPDATE `posts` (UPDATE existente) | Worker actualiza post request del cliente; `newImageUrl = body.image_url ?? body.image_urls?.[0]` |
| [src/app/api/worker/posts/route.ts:172](src/app/api/worker/posts/route.ts#L172) | INSERT `posts` | Worker crea nuevo post; misma lógica de `newImageUrl` |
| [src/app/api/worker/posts/[id]/route.ts:52](src/app/api/worker/posts/%5Bid%5D/route.ts#L52) | UPDATE `posts` | PATCH worker: solo si `body.image_url !== undefined` (campo opcional) |
| [src/app/api/posts/[id]/assets/route.ts:98](src/app/api/posts/%5Bid%5D/assets/route.ts#L98) | UPDATE `posts` | POST assets: promueve `asset_url` como imagen actual del post |
| [src/app/api/posts/[id]/assets/route.ts:133](src/app/api/posts/%5Bid%5D/assets/route.ts#L133) | UPDATE `posts` | PATCH approve: aprueba un asset concreto → `image_url = asset.asset_url` |
| [src/app/api/posts/[id]/assets/route.ts:159](src/app/api/posts/%5Bid%5D/assets/route.ts#L159) | UPDATE `posts` | PATCH set_current: cambia versión activa → `image_url = asset.asset_url` |
| [src/lib/agents/handlers/materialize.ts:130](src/lib/agents/handlers/materialize.ts#L130) | INSERT `posts` | Agente materializa post desde solicitud; `imageUrl` viene del job input |
| [src/lib/agents/handlers/materialize.ts:153](src/lib/agents/handlers/materialize.ts#L153) | UPDATE `posts` | Agente actualiza post existente con imagen generada |

### 2.2 `posts.edited_image_url`

| Archivo:línea | Operación | Condición / Trigger |
|---|---|---|
| [src/app/api/worker/posts/[id]/approve/route.ts:56](src/app/api/worker/posts/%5Bid%5D/approve/route.ts#L56) | UPDATE `posts` | Worker aprueba revisión con imagen (`revision.image_url` no null) → `edited_image_url = revision.image_url`, `status → 'client_review'` |
| [src/app/api/worker/posts/[id]/manual-upload/route.ts:84](src/app/api/worker/posts/%5Bid%5D/manual-upload/route.ts#L84) | UPDATE `posts` | Worker sube imagen manual → `edited_image_url = publicUrl` (bucket `assets`) |
| [src/app/api/webhooks/replicate/route.ts:226](src/app/api/webhooks/replicate/route.ts#L226) | UPDATE `posts` | Webhook Replicate: prediction `succeeded` → imagen persistida a bucket `posts`, `edited_image_url = generatedUrl`, `status → 'pending'` |
| [src/lib/agents/handlers/local.ts:158](src/lib/agents/handlers/local.ts#L158) | UPDATE `posts` | Handler local (NanoBanana / Higgsfield): job completado, primera rama (con revisión asociada) |
| [src/lib/agents/handlers/local.ts:311](src/lib/agents/handlers/local.ts#L311) | UPDATE `posts` | Handler local: segunda rama (sin revisión) — comentario explícito: *"image_url is the original client upload and must never be overwritten"* |

### 2.3 `posts.video_url`

| Archivo:línea | Operación | Condición / Trigger |
|---|---|---|
| [src/app/api/worker/jobs/[id]/complete/route.ts:62](src/app/api/worker/jobs/%5Bid%5D/complete/route.ts#L62) | UPDATE `posts` | Worker completa job de vídeo: `body.video_url` present → `postUpdate.video_url` |
| [src/app/(worker)/worker/page.tsx:1181](src/app/%28worker%29/worker/page.tsx#L1181) | UPDATE `posts` vía job complete | Worker valida vídeo en cola: sube fichero a storage, llama a `/api/worker/jobs/[id]/complete` con `video_url` |
| [src/app/(worker)/worker/validation/_components/ReclamadasQueue.tsx:65](src/app/%28worker%29/worker/validation/_components/ReclamadasQueue.tsx#L65) | UPDATE `posts` vía job complete | Misma lógica desde vista de reclamadas |

### 2.4 `posts.generated_images` / `generation_done` / `generation_total`

| Archivo:línea | Operación | Condición / Trigger |
|---|---|---|
| [src/app/api/posts/[id]/generate-image/route.ts:82](src/app/api/posts/%5Bid%5D/generate-image/route.ts#L82) | UPDATE `posts` | Inicio de batch: resetea `generated_images=[]`, `generation_done=0`, `generation_total=photoCount`, `status='pending'` |
| [src/lib/agents/handlers/validator.ts:199](src/lib/agents/handlers/validator.ts#L199) | UPDATE `posts` (atomic) | Validador aprueba imagen: append URL a `generated_images`, incrementa `generation_done` |

### 2.5 `post_revisions.image_url`

| Archivo:línea | Operación | Condición / Trigger |
|---|---|---|
| [src/app/api/worker/posts/[id]/regenerate/route.ts:74](src/app/api/worker/posts/%5Bid%5D/regenerate/route.ts#L74) | INSERT `post_revisions` | Worker lanza regeneración: placeholder con `image_url = null` |
| [src/app/api/worker/posts/[id]/manual-upload/route.ts:73](src/app/api/worker/posts/%5Bid%5D/manual-upload/route.ts#L73) | INSERT `post_revisions` | Worker sube manualmente: `model='manual_upload'`, `image_url = publicUrl` |
| [src/app/api/webhooks/replicate/route.ts](src/app/api/webhooks/replicate/route.ts) | UPDATE `post_revisions` | Replicate completa: rellena `image_url` en la revisión placeholder creada por `/regenerate` |
| [src/lib/agents/handlers/local.ts:167](src/lib/agents/handlers/local.ts#L167) | INSERT `post_revisions` | Handler local completa: INSERT con `image_url = primaryUrl` |
| [src/lib/agents/handlers/local.ts:191](src/lib/agents/handlers/local.ts#L191) | INSERT `post_revisions` | Handler local, rama alternativa |
| [src/lib/agents/handlers/local.ts:347](src/lib/agents/handlers/local.ts#L347) | INSERT `post_revisions` | Handler local, rama con retry |
| [src/lib/agents/handlers/local.ts:396](src/lib/agents/handlers/local.ts#L396) | INSERT `post_revisions` | Handler local, rama final |

### 2.6 Rutas específicas solicitadas — conclusiones

| Ruta | Escribe imagen | Detalle |
|---|---|---|
| `/api/worker/posts/[id]/approve` | **SÍ** — `posts.edited_image_url` | Copia `revision.image_url` → `edited_image_url` |
| `/api/worker/posts/[id]/regenerate` | **NO** (indirecto) | Crea placeholder `post_revisions.image_url = null`; la imagen la escribe el webhook/handler |
| `/api/worker/posts/[id]/manual-upload` | **SÍ** — `posts.edited_image_url` + `post_revisions.image_url` | Sube a bucket `assets`, escribe ambas columnas |
| `/api/worker/posts/[id]/reanalyze` | **NO** — solo lectura | Lee `posts.image_url` como `sourceImageUrl` para construir el brief; no escribe |
| `/api/worker/retouch-requests/[id]/resolve` | **NO** | Solo actualiza `retouch_requests.status` y opcionalmente `posts.caption`/`posts.scheduled_at`. Sin columnas de imagen. |
| Webhook Replicate | **SÍ** — `posts.edited_image_url` | Persiste imagen a bucket `posts`, actualiza `edited_image_url` |
| Handler NanoBanana (local.ts) | **SÍ** — `posts.edited_image_url` + `post_revisions.image_url` | Bucket `assets`; escribe `edited_image_url` y crea revisión |

---

## 3. Readers — componentes cliente que leen cada columna

Scope: `src/app/(dashboard)/` y `src/components/` (excluye rutas worker).

### 3.1 `posts.edited_image_url`

| Archivo:línea | Qué hace | Fallback si null | Estado del post requerido |
|---|---|---|---|
| [src/app/(dashboard)/posts/[id]/page.tsx:415](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L415) | `heroUrl = post.edited_image_url ?? post.image_url` — imagen principal del detail | `image_url` | Cualquier estado visible al cliente |
| [src/app/(dashboard)/posts/[id]/page.tsx:416-417](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L416) | Muestra imagen original debajo si `edited_image_url !== image_url` | No aplica | Idem |
| [src/app/(dashboard)/posts/[id]/page.tsx:443-444](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L443) | Actualiza `edited_image_url` en local state + PATCH cuando usuario selecciona versión | — | Cualquier estado |
| [src/app/(dashboard)/feed/page.tsx:317](src/app/%28dashboard%29/feed/page.tsx#L317) | `const img = post.edited_image_url ?? post.image_url` — feed grid principal | `image_url` | Cualquier estado publicado/aprobado |
| [src/app/(dashboard)/feed/page.tsx:361](src/app/%28dashboard%29/feed/page.tsx#L361) | Idem, vista de lista | `image_url` | Idem |
| [src/app/(dashboard)/feed/page.tsx:406](src/app/%28dashboard%29/feed/page.tsx#L406) | Idem, vista de detalle rápido | `image_url` | Idem |

### 3.2 `posts.image_url`

| Archivo:línea | Qué hace | Fallback si null | Estado del post requerido |
|---|---|---|---|
| [src/app/(dashboard)/posts/[id]/page.tsx:415-417](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L415) | Fallback de `heroUrl`; también `origUrl` si difiere de `edited_image_url` | Placeholder/null | Cualquiera |
| [src/app/(dashboard)/posts/[id]/page.tsx:775,778](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L775) | `videoUrl={post.video_url ?? post.image_url!}` en TikTok preview | `video_url` primero | format=video/reel + platform=tiktok |
| [src/app/(dashboard)/posts/[id]/page.tsx:896](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L896) | `currentImageUrl={post.image_url}` pasado a `VersionsPanel` | — | Cualquiera |
| [src/app/(dashboard)/posts/page.tsx:434,437](src/app/%28dashboard%29/posts/page.tsx#L434) | Thumbnail en lista de posts | No renderiza img si null | Cualquiera |
| [src/app/(dashboard)/dashboard/page.tsx:524,526](src/app/%28dashboard%29/dashboard/page.tsx#L524) | Thumbnail 40×40 en tiles del dashboard | No renderiza si null | Cualquiera |
| [src/app/(dashboard)/calendar/page.tsx:291,293](src/app/%28dashboard%29/calendar/page.tsx#L291) | Thumbnail 14×14 en celda del calendario | No renderiza si null | `scheduled_at` presente |
| [src/app/(dashboard)/feed/page.tsx:317,361,406](src/app/%28dashboard%29/feed/page.tsx#L317) | Fallback de `edited_image_url` | — | Publicado/aprobado |
| [src/app/(dashboard)/planificacion/_components/CalendarView.tsx:220,223](src/app/%28dashboard%29/planificacion/_components/CalendarView.tsx#L220) | Thumbnail en semana de planificación | No renderiza si null | `scheduled_at` presente |
| [src/components/posts/VersionsPanel.tsx:57,130,131,148](src/components/posts/VersionsPanel.tsx#L57) | Muestra versiones de la imagen; `currentImageUrl` como referencia activa | — | Cualquiera |
| [src/components/dashboard/WeeklyProposals.tsx:127-129](src/components/dashboard/WeeklyProposals.tsx#L127) | Thumbnail en propuestas semanales | No renderiza si null | `status = 'generated'` o similar |

### 3.3 `posts.video_url`

| Archivo:línea | Qué hace | Fallback si null | Estado del post requerido |
|---|---|---|---|
| [src/app/(dashboard)/posts/[id]/page.tsx:775,778](src/app/%28dashboard%29/posts/%5Bid%5D/page.tsx#L775) | `videoUrl={post.video_url ?? post.image_url!}` — player de TikTok | `image_url` | format=video/reel + platform=tiktok |

### 3.4 `posts.generated_images`

**No hay readers en `src/app/(dashboard)/` ni `src/components/`.** La columna es consumida exclusivamente por:
- `src/lib/agents/handlers/validator.ts` (lectura+escritura interna del pipeline)
- Worker: queries en `src/app/(worker)/` (fuera del scope cliente)

### 3.5 API routes (intermediarias, no UI directa)

| Archivo | Columnas leídas | Uso |
|---|---|---|
| [src/lib/agents/handlers/publishing.ts:50,63](src/lib/agents/handlers/publishing.ts#L50) | `edited_image_url`, `image_url` | `mediaUrl = edited_image_url ?? image_url` al publicar en Meta/TikTok |
| [src/app/api/historial/route.ts](src/app/api/historial/route.ts) | `image_url`, `edited_image_url` | Historial/export endpoint |
| [src/app/api/worker/cola/route.ts](src/app/api/worker/cola/route.ts) | `image_url`, `edited_image_url` | Cola del worker |

---

## 4. Supabase Storage

### Buckets utilizados

| Bucket | Acceso | Qué se sube | Naming convention | Quién lo usa |
|---|---|---|---|---|
| `posts` | **Público** (`getPublicUrl`) | Imágenes generadas por Replicate; uploads de cliente vía PostEditor y biblioteca | Replicate: `replicate/{brandId}/{timestamp}-{uuid}.{ext}` · Biblioteca/PostEditor: no estandarizado (ruta arbitraria por cliente) · ImageEditAgent: `fileName` desde contexto de job | Webhook Replicate, `ImageEditAgent.ts:127`, `src/app/(dashboard)/biblioteca/page.tsx:123`, `src/components/posts/PostEditor.tsx:290` |
| `assets` | **Público** (`getPublicUrl`) | Imágenes de manual-upload, generadas por NanoBanana/Higgsfield/VideoGenerateAgent/ImageGenerateAgent | Manual upload: `manual/{post_id}/{Date.now()}.{ext}` · Agents: `fileName` desde contexto de job | `manual-upload/route.ts`, `local.ts:141`, `VideoGenerateAgent.ts:164`, `HiggsFieldAgent.ts:163`, `ImageGenerateAgent.ts:243` |
| `media` | **Público** (`getPublicUrl`) | Imágenes de anuncios (worker announcements) | `announcements/{timestamp}-{random}{ext}` | `src/app/api/upload/route.ts` |
| `inspiration` / `BUCKET` | **Público** (`getPublicUrl`) | Imágenes de inspiración | Definido en `src/lib/inspiration/storage.ts` | `src/lib/inspiration/storage.ts:33` |
| `stories-rendered` | **Público** (`getPublicUrl`) | Imágenes renderizadas de stories/content_ideas | path desde `/api/render/story/[idea_id]` | `src/app/api/render/story/[idea_id]/route.ts:71` |

**Todos los buckets usan `getPublicUrl`** — no hay `createSignedUrl` detectado en ningún writer de posts. Las URLs son permanentes e inmutables.

**Dominio temporal Replicate:** las URLs `replicate.delivery/...` tienen TTL de ~1 hora. El webhook las persiste a bucket `posts` antes de actualizar la base de datos.

---

## 5. Real-time subscriptions del cliente a `posts`

### En `src/app/(dashboard)/`

**No se encontró ningún `.channel(...)` en rutas del dashboard cliente.**

Los datos de posts en el dashboard se cargan mediante:
- Fetch one-shot al montar el componente (SWR o fetch directo)
- Botón manual de refresco en algunos componentes
- No hay subscriptions reactivas a la tabla `posts` en la UI del cliente

### En `src/app/(worker)/`

| Archivo:línea | Canal | Filtro | Evento | Callback |
|---|---|---|---|---|
| [src/app/(worker)/worker/central/page.tsx:232](src/app/%28worker%29/worker/central/page.tsx#L232) | `worker-posts-changes` | Ninguno (todos los posts) | `*` (INSERT/UPDATE/DELETE) | Toast + refetch `/api/worker/dashboard` |

---

## 6. Tabla resumen cruzada

| Columna | Writers principales | Readers cliente (dashboard) | ¿Match? |
|---|---|---|---|
| `posts.image_url` | Worker POST/PATCH, cliente new post, assets API, materialize handler | `posts/[id]`, `posts/`, `dashboard`, `calendar`, `feed`, `planificacion/CalendarView`, `VersionsPanel`, `WeeklyProposals` | ✅ Bien conectado |
| `posts.edited_image_url` | approve route, manual-upload, Replicate webhook, local handler (NanoBanana/Higgsfield) | `posts/[id]` (hero), `feed/` (3 vistas) | ⚠️ Solo 2 páginas cliente lo leen; `dashboard/`, `calendar/`, `planificacion/` usan únicamente `image_url` sin fallback a `edited_image_url` |
| `posts.video_url` | Worker jobs complete, worker validation upload | `posts/[id]` (solo TikTok format=video) | 🔴 Un único reader muy condicionado; páginas de calendar/feed/dashboard no lo leen |
| `posts.generated_images` | generate-image reset, validator append | **Ninguno en dashboard cliente** | 🔴 Writer activo, cero readers en UI cliente |
| `posts.generation_total` | generate-image route | **Ninguno en dashboard cliente** | 🔴 Writer activo, cero readers en UI cliente |
| `posts.generation_done` | validator.ts | **Ninguno en dashboard cliente** | 🔴 Writer activo, cero readers en UI cliente |
| `post_revisions.image_url` | regenerate placeholder, manual-upload, Replicate webhook, local handler | **Ninguno en dashboard cliente** (solo worker: `CurrentResultPanel`, `RevisionTimeline`, `WorkerActionBar`) | 🔴 Columna exclusiva del portal worker; el cliente solo ve el resultado final vía `posts.edited_image_url` |

### Leyenda

- ✅ Writers y readers alineados
- ⚠️ Conectado pero con gaps: algunos lectores del dashboard usan solo `image_url` en contextos donde debería usar `edited_image_url ?? image_url`
- 🔴 Writer sin readers en UI cliente (o vice-versa)

---

## 7. Flujo end-to-end resumido

```
Cliente sube fichero
  └─▶ posts.image_url = URL original   [new/page.tsx o worker/posts/route.ts]

Worker lanza regeneración
  └─▶ post_revisions INSERT image_url = null   [/regenerate]
       └─▶ Job encolado (Replicate / NanoBanana / Higgsfield)
            └─▶ Webhook/handler completa
                 ├─▶ post_revisions.image_url = URL generada
                 └─▶ posts.edited_image_url   = URL generada   [si es local handler]

Worker aprueba revisión
  └─▶ posts.edited_image_url = revision.image_url   [/approve]
       posts.status → 'client_review'

Cliente ve el post
  └─▶ heroUrl = edited_image_url ?? image_url   [posts/[id]/page.tsx:415]

Publicación
  └─▶ mediaUrl = edited_image_url ?? image_url   [publishing.ts:63]
```

```
Batch multi-foto (generate_image job)
  └─▶ posts.generation_total = N, generated_images = [], generation_done = 0   [generate-image/route.ts]
       └─▶ N jobs en paralelo
            └─▶ Cada job → validator
                 └─▶ validator aprueba → generated_images.push(url), generation_done++
                      └─▶ Cuando generation_done === generation_total → notificación cliente
                           [cliente no tiene reader de generated_images en UI actual]
```
