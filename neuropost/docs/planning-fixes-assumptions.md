# Planning Pipeline Fixes — Suposiciones y Preguntas Resueltas

> **Fecha:** 2026-04-23  
> **Propósito:** Documentar las respuestas a las 10 preguntas abiertas del audit  
> (`docs/audit-planning-pipeline.md § Sección 8`) y las suposiciones adoptadas  
> cuando no fue posible verificar algo directamente en el código.  
> Si una suposición resulta incorrecta, esta es la guía de qué revisar.

---

## Pregunta 1 — ¿`client_feedback` existe en producción como tabla?

**Veredicto: NO EXISTE como tabla independiente.**

- Búsqueda en `supabase/migrations/`, `supabase/schema.sql`, `supabase/schema_phase3.sql` → sin resultados.
- La única aparición es `src/scripts/worker-schema.sql:31` donde `client_feedback` es una **columna** en otra tabla (recreation_requests), no una tabla propia.
- El código en `src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts:95` hace `db.from('client_feedback').insert(...)` sin `.throwOnError()`. En Supabase, si la tabla no existe, el INSERT devuelve un error en el objeto `{ data, error }` que se descarta silenciosamente.

**Riesgo:** Las acciones del cliente (aprobar, editar, rechazar, pedir variación) **no tienen auditoría persistida** en producción hoy.

**Suposición adoptada:** La tabla `client_feedback` debe crearse como parte de la Fase 1 (migración). El schema se infiere del código que hace el INSERT:

```sql
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id        uuid NOT NULL REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  idea_id        uuid NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  action         text NOT NULL CHECK (action IN ('approve','edit','request_variation','reject')),
  comment        text,
  previous_value jsonb,
  new_value      jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

**Esta es la única pregunta que bloquea código existente.** Se incluye en la migración de Fase 1.

---

## Pregunta 2 — ¿`content_ideas` tiene `original_idea_id`?

**Veredicto: SÍ, existe.**

- Definida en `supabase/regenerate_idea_support.sql:13`:  
  `ADD COLUMN IF NOT EXISTS original_idea_id UUID REFERENCES public.content_ideas(id) ON DELETE SET NULL`
- Índice: `idx_content_ideas_original ON content_ideas(original_idea_id)`
- La tabla `regenerate_idea_support.sql` también crea el unique partial index `idx_content_ideas_week_position` (excluye `replaced_by_variation` y `regenerating`).

**Impacto en las fases:** ninguno — la columna ya existe.

---

## Pregunta 3 — ¿`brand.use_new_planning_flow` está activo para todos los brands?

**Veredicto: NO está definido en ninguna migración SQL encontrada.**

- La columna `use_new_planning_flow boolean` aparece en `src/types/index.ts:200` como parte del tipo `Brand`.
- La migración que la añade a la tabla `brands` **no está en `supabase/migrations/`**.  
  Puede estar en `supabase/schema.sql` en una sección no leída, o fue añadida manualmente en producción.
- Sidebar.tsx:98 la usa como guard: si `false`, el menú de planificación no aparece → la feature es **opt-in por brand**, no universal.

**Suposición adoptada:** La flag es opt-in. Brands sin la columna o con `use_new_planning_flow = false` siguen usando el legacy flow (fan-out de sub_jobs). Los arreglos de las fases solo afectan al new flow. Esto es **backwards-compatible** por diseño del propio código (`plan-week.ts:150`: `if (brand?.use_new_planning_flow)`).

**Acción recomendada (fuera de estas fases):** Crear migración que añada la columna con `DEFAULT false` si no existe.

---

## Pregunta 4 — ¿`regenerate_idea` handler está implementado?

**Veredicto: SÍ, existe y está completo.**

- Archivo: `src/lib/agents/strategy/regenerate-idea.ts`  
- Registrado en `src/lib/agents/handlers/strategy.ts` (según el barrel de handlers)
- Flujo confirmado:
  1. Carga idea original + feedback histórico del cliente
  2. Llama a Claude para generar variación (respeta categoría y formato original)
  3. INSERT nueva idea con `original_idea_id = old_idea_id`
  4. UPDATE idea original → `status = 'replaced_by_variation'`
  5. Llama a `routeIdea()` → puede crear `worker_notification` si está habilitada la revisión de regeneraciones
  6. En fallo: revierte original a `'pending'` para no dejar al cliente atascado

---

## Pregunta 5 — ¿El runner procesa jobs de `plan_week` vía cron o trigger manual?

**Veredicto: Vía cron `agent-queue-runner` cada minuto.**

- `vercel.json`: `{ "path": "/api/cron/agent-queue-runner", "schedule": "* * * * *" }`
- El runner usa `claim_agent_jobs(p_limit)` con `FOR UPDATE SKIP LOCKED` (atómico, sin race conditions en el claim).
- Timeout por job: 45s (normal), 240s para acciones `generate_human_photo/video`.
- La función `plan_week` no está en `LONG_TIMEOUT_ACTIONS` → timeout de 45s.  
  ⚠️ Con la generación de stories incluyendo Claude Haiku + render fire-and-forget, 45s puede ser justo si hay muchas stories o latencia alta. Los renders son fire-and-forget, así que no bloquean.

---

## Pregunta 6 — ¿Qué dispara `producing → calendar_ready → completed`?

**Veredicto: Parcialmente NO VERIFICADO.**

- `producing` se activa desde `POST /api/client/weekly-plans/[id]/confirm` → `confirm/route.ts:85`.
- `calendar_ready` y `completed`: no encontrados en ninguna route handler ni cron que haga esa transición.
- El pipeline semanal (`pipelines/weekly.ts`) incluye `scheduling:auto_schedule_week` que podría hacerlo, pero no lo he leído.
- La UI ya muestra estas etiquetas en `/planificacion/page.tsx` pero son estados "finales" en la práctica actual.

**Suposición adoptada:** `calendar_ready` y `completed` son estados futuros que aún no se disparan automáticamente (el pipeline está parcialmente implementado). No los tocamos en estas fases.

---

## Pregunta 7 — ¿`app_settings.human_review_defaults` está inicializado en producción?

**Veredicto: SÍ, tiene seed.**

- `supabase/app_settings.sql:17-22`: INSERT con `ON CONFLICT (key) DO NOTHING`:
  ```json
  { "messages": true, "images": true, "videos": true, "requests": true }
  ```
- `supabase/human_review_flags_split.sql:15-26`: UPDATE añade las variantes `_create`/`_regen`:
  ```json
  { "messages_create": true, "images_create": true, "videos_create": true,
    "messages_regen": true,  "images_regen": true,  "videos_regen": true }
  ```

**Consecuencia:** Por defecto, **todo plan semanal va a worker review** (`messages_create: true` → `routeIdea` → `worker_review`). Esto es el comportamiento conservador documentado.

---

## Pregunta 8 — ¿Hay job de limpieza/expiración para planes atascados?

**Veredicto: NO existe un cron específico de expiración de planes.**

- Revisados todos los crons en `vercel.json` y sus implementaciones: ninguno hace `transitionWeeklyPlanStatus → 'expired'`.
- `monday-brain` (`src/app/api/cron/monday-brain/route.ts`) lanza el pipeline semanal para cada brand pero no expira planes viejos.
- El cron `plan-reminders` podría tener algo relacionado, pero no lo verifiqué en profundidad.

**Suposición adoptada:** No existe. El cron `detect-stuck-plans` de la Fase 2 cubre este gap.

---

## Pregunta 9 — ¿El bucket `stories-rendered` en Supabase Storage es público o privado?

**Veredicto: PÚBLICO (inferido, no verificado en Dashboard de Supabase).**

- El código usa `db.storage.from('stories-rendered').getPublicUrl(path)` en dos lugares  
  (`render/route.ts:155`, `render/route.ts:178`).
- `getPublicUrl` en Supabase solo funciona si el bucket tiene acceso público. Si fuera privado, la URL devuelta no sería accesible y las imágenes no se mostrarían en la UI.
- Como las stories se muestran como `<img src={rendered_image_url}>` en la UI del cliente, deben ser accesibles públicamente.

**Riesgo residual:** Si el bucket tiene políticas de Storage (RLS), las URLs podrían estar protegidas con signed URLs. No verificado en el Dashboard de Supabase. Asumir público para las fases.

---

## Pregunta 10 — ¿Qué pasa con las stories cuando el cliente confirma el plan?

**Veredicto: Las stories NO entran en el flujo de producción de `confirm`.**

- `confirm/route.ts:51-53`: filtra `status IN ('client_approved','client_edited')`.
- En la UI de revisión (`planificacion/[week_id]/page.tsx`): las stories se muestran en una galería (`storyIdeas`) sin botones de acción individuales (no hay approve/reject/edit). Son de lectura.
- El progreso de revisión solo cuenta `postIdeas` (no stories).
- **Las stories se publican por un flujo separado no identificado en el audit.**  
  Probablemente el agente `scheduling:auto_schedule_week` o un endpoint de publicación directo las gestiona.

**Suposición adoptada:** Las stories son contenido "automático" no revisable individualmente por el cliente. El cliente las ve como preview pero no las aprueba. No modificamos este comportamiento en estas fases.

---

## Estado base de tests

**Framework:** No hay vitest/jest. Los "tests" son scripts `tsx` que requieren conexión a Supabase/Claude en producción.

**Scripts de test disponibles:**
```
test:sprint3    test:sprint6    test:sprint11   test:sprint12
test:reminders  test:edited-image-url  test:visual-strategist
test:sprint2-cockpit  test:post-notifications  test:sprint3-form
email:test
```

**Estado base `tsc --noEmit`:**
- **1 error pre-existente:** `../backend/agents/ideas/ideas-agent.ts(40,46): error TS7006: Parameter 'b' implicitly has 'any' type.`
- Este error está en el monorepo backend (fuera de `neuropost/src/`), no es introducido por nuestros cambios.

**Línea base establecida:** 1 error de compilación pre-existente (externo, no tocable). 0 fallos de tests automatizados propios (no hay suite unitaria). Los scripts de integración requieren entorno real y no se ejecutan en pre-commit.

---

## Decisiones de diseño tomadas en las fases

| Decisión | Justificación |
|---|---|
| Los nuevos crons usan `Authorization: Bearer $CRON_SECRET` igual que los existentes | Consistencia con el patrón de `vercel.json` y `health-check/route.ts` |
| `enqueueClientReviewEmail` pasa de `Promise<void>` a `Promise<{ok,error?}>` | Permite al caller saber si el email se envió sin romper la API hacia atrás (misma función, nueva signatura) |
| `render_status` como columna dedicada en lugar de inferir de `rendered_image_url IS NULL` | Permite distinguir `not_applicable` (posts) de `pending_render` (story no iniciada), que `IS NULL` no puede hacer |
| `client_feedback` tabla se crea en Fase 1 (no en Fase 0) | Necesita estar en el mismo commit que los cambios de código que la usan, para que el rollback sea atómico |
| Logger `src/lib/logger.ts` es una función pura sin dependencias externas | Evita añadir dependencias (pino, winston) por un caso de uso simple; compatible con cualquier futura integración |
