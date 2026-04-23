# Planning Fase 4 — Preflight

## 1. Estado de compilación

`npx tsc --noEmit` — **0 errores** (limpio).

---

## 2. Sentry — INSTALADO

`@sentry/nextjs` está en uso activo:

| Fichero | Uso |
|---|---|
| `src/app/error.tsx:14` | `Sentry.captureException(error)` |
| `src/app/api/cron/health-check/route.ts:168` | `Sentry.captureMessage(...)` |
| `src/lib/agents/runner.ts:202` | `Sentry.captureException(err, { tags: { component: 'agent-runner' } })` |
| `src/lib/api-utils.ts:50` | `Sentry.captureException(err, { extra: ... })` en `apiError()` |

**Implicación P21**: usar `Sentry.captureException` directamente, no `sentry_candidate`.

---

## 3. `logAudit` — firma real

```typescript
// src/lib/audit.ts:37
export async function logAudit(entry: AuditLogEntry): Promise<void>

interface AuditLogEntry {
  actor_type: 'user' | 'worker' | 'agent' | 'system' | 'stripe_webhook' | 'cron';
  actor_id?:     string;
  actor_name?:   string;
  actor_ip?:     string;
  action:        string;          // ← cadena libre, no enum
  resource_type: string;          // ← requerido
  resource_id?:  string;
  resource_name?: string;
  brand_id?:     string;
  description:   string;          // ← requerido
  changes?:      Record<string, { old: any; new: any }> | null;
  metadata?:     Record<string, any> | null;
  severity?:     'info' | 'warning' | 'critical';
}
```

También existe `logAgentAction(agentKey, action, resourceType, description, opts?)` que es un wrapper más cómodo para el contexto de agentes.

**⚠️ Divergencia con el spec:** El spec muestra llamadas del tipo `logAudit({ level: 'error', scope: 'plan-week', event: 'xxx' })` — eso es la firma de `log()` del logger, NO de `logAudit()`. Las llamadas a `logAudit` en Fase 4 deben usar la firma real.

---

## 4. `checkStoryLimit` — firma real y problema de contexto

```typescript
// src/lib/plan-limits.ts:76
export async function checkStoryLimit(brandId: string): Promise<PlanLimitResult>

interface PlanLimitResult {
  allowed:     boolean;
  reason?:     string;     // mensaje de error legible
  upgradeUrl?: string;
}
// NO existe campo `remaining`
```

**⚠️ Divergencia con el spec:** El spec muestra `checkStoryLimit(db, job.brand_id, plan)` y `limitCheck.remaining` — ambos incorrectos.

**⚠️ Problema de contexto:** `checkStoryLimit` usa `createServerClient()` internamente. Ese cliente requiere cookies de sesión HTTP y NO funciona en el contexto del runner de agentes (background job, sin request HTTP). Llamarlo desde `plan-week.ts` devolvería `brand = null` y siempre diría `allowed: true`.

**Solución para P12:** Implementar la comprobación inline en `plan-week.ts` usando el `createAdminClient()` ya disponible:

```typescript
// inline en plan-week.ts — contexto agente, usa admin client ya disponible
const storiesLimit  = planQuota?.stories_per_week ?? 0;
const { data: usageRow } = await db.from('brands').select('stories_this_week').eq('id', job.brand_id).single();
const storiesUsed   = (usageRow?.stories_this_week as number | null) ?? 0;
const storiesQuota  = Math.max(0, storiesLimit - storiesUsed);
```

---

## 5. P13 — Cliente puede editar stories (Case B)

`src/app/api/client/weekly-plans/[id]/ideas/[ideaId]/route.ts` no tiene ningún guard que bloquee edits de stories. El `ACTION_TO_STATUS` map acepta `edit` sin comprobar `content_kind`. 

**Case B aplica**: al editar una idea con `content_kind === 'story'`, hay que marcarla `render_status = 'pending_render'` para que el cron `reconcile-renders` la reprocese.

---

## 6. `render_status` — valores válidos

Del código de `render/story/[idea_id]/route.ts` y `reconcile-renders/route.ts`:

```
'pending_render'   — en cola para renderizar
'rendering'        — en proceso
'rendered'         — completado con éxito
'render_failed'    — fallado (con contador de intentos)
```

El campo no está en el type `ContentIdea` de `src/types/index.ts` — vive en la tabla pero no en el tipo TypeScript. Para P16, el acceso debe hacerse con cast o usando `(idea as any).render_status`.

---

## 7. schedule case — plan-stories.ts

```typescript
// src/lib/agents/stories/plan-stories.ts:51-58
case 'schedule': {
  const c = source.content as BrandMaterialV2<'schedule'>['content'];
  const chosen = pickActiveSchedule(c.schedules, now);
  const days = chosen?.days ?? [];
  return days.map(d => `${translateDay(d.day)}: ${d.hours}`).join('\n');
}
```

- Ya usa `?.days ?? []` — no explota si `chosen` es null.  
- **No valida que cada `d` tenga `d.day` string y `d.hours` string.** Si el material está corrupto (e.g. `{ day: null, hours: undefined }`), `translateDay(null)` produce `"null"` y `d.hours` produce `"undefined"`.  
- **Guard P19 necesario**: filtrar elementos donde `d.day` y `d.hours` no sean strings.

---

## 8. Resumen de divergencias respecto al spec

| Problema | Divergencia | Ajuste en implementación |
|---|---|---|
| P12 | `checkStoryLimit(db, brandId, plan)` no existe | Inline con admin client; sin campo `remaining` |
| P14 | `logAudit({ level, scope, event })` es firma de `log()` | Usar `logAudit({ actor_type, action, resource_type, description })` o wrapper `logAgentAction()` |
| P21 | Spec: "si Sentry no está, usar sentry_candidate" | Sentry está instalado — usar `Sentry.captureException` directamente |
| P16 | `render_status` no está en el type `ContentIdea` | Cast o access via `(idea as any).render_status` |
