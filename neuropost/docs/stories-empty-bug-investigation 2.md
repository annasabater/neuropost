# Investigación: Stories generadas post-Fase 4 sin imagen de fondo

> **Fecha:** 2026-04-23  
> **Estado:** Diagnóstico completado. Fix propuesto. Pendiente de confirmación DB antes de implementar.  
> **Severidad:** 🟡 Alta — stories renderizadas sin imagen de fondo, aspecto visualmente pobre pero sin pérdida de datos.

---

## Sección 1 — Resultados de las queries de diagnóstico

> ⚠️ **Las queries del Paso 1 deben ejecutarse por el operador en Supabase Studio.** El análisis de código siguiente no requiere los resultados para concluir el diagnóstico, pero sí para cuantificar el alcance exacto del daño y confirmar la hipótesis B (preexistente vs regresión).

Pega aquí los resultados cuando los tengas:

```
-- Query A: últimos 5 planes con stories
[PENDIENTE]

-- Query B: comparativa pre/post Fase 4
[PENDIENTE — crítica para confirmar si es regresión]

-- Query C: pool de imágenes del brand
[PENDIENTE]

-- Query D: copy real de las stories afectadas  
[PENDIENTE — crítica para confirmar tipo de copy]
```

---

## Sección 2 — Análisis de código por hipótesis

### Hipótesis 1: el refactor de P17 rompió la asignación de image_generation_prompt

**DESCARTADA.**

El refactor de P17 movió el prompt de Replicate del campo `hook` a la columna `image_generation_prompt`. La lógica de asignación es semánticamente idéntica antes y después:

**Antes (pre-Fase 4)** — `plan-stories.ts` original:
```typescript
const hookValue = !imageUrl && creative.imagePrompt
  ? `REPLICATE:${creative.imagePrompt}`
  : null;
// → hook = 'REPLICATE:{prompt}' SI hay prompt, o null SI no hay prompt
```

**Después (post-Fase 4)** — `plan-stories.ts:303-304`:
```typescript
const imageGenPrompt = !imageUrl && creative.imagePrompt ? creative.imagePrompt : null;
// → image_generation_prompt = '{prompt}' SI hay prompt, o null SI no hay prompt
```

En ambos casos: si `creative.imagePrompt = ''` (string vacío), la condición es `!imageUrl && ''` → falsy → resultado `null`. La columna `image_generation_prompt` acaba en `null` exactamente igual que antes acababa `hook` en `null`. **La regresión de P17 queda descartada.**

---

### Hipótesis 2: el brand no tiene imágenes en el pool

**PROBABLE CONTRIBUYENTE, no causa raíz.**

`plan-week.ts:215-226` carga inspiration_refs y media_library en paralelo:
```typescript
const [{ data: inspirationRefs }, { data: mediaRefs }] = await Promise.all([
  db.from('inspiration_references').select('id, thumbnail_url')
    .eq('brand_id', job.brand_id).eq('is_saved', true).not('thumbnail_url', 'is', null),
  db.from('media_library').select('url')
    .eq('brand_id', job.brand_id).eq('type', 'image'),
]);
```

Si ambos arrays están vacíos → `allImages = []` en `plan-stories.ts:287-292` → `imageUrl = null` para todos los slots.

Con `imageUrl = null` la condición de `imageGenPrompt` se reduce a: `creative.imagePrompt || null`. Es decir, **si el pool está vacío, la única fuente de imagen es Claude generando un imagePrompt**. El pool vacío no causa el bug, pero sí lo amplifica: si Claude también falla en generar imagePrompts, el fallo es total (sin imagen de ningún tipo).

Confirmación pendiente de Query C.

---

### Hipótesis 3: el render endpoint "renderiza" sin imagen y marca `rendered`

**CONFIRMADA.** Es el comportamiento esperado, pero es lo que produce las stories "vacías" visualmente.

`render/story/[idea_id]/route.ts:163-194`:
```typescript
let bgImageUrl: string | null = idea.suggested_asset_url ?? null;

const imageGenPrompt: string | null = idea.image_generation_prompt ?? null;
const hook = typeof idea.hook === 'string' ? idea.hook : null;
const replicatePrompt = imageGenPrompt ?? (hook?.startsWith('REPLICATE:') ? ... : null);

if (replicatePrompt) {
  // Genera imagen Replicate y asigna a bgImageUrl
  ...
}
// Si replicatePrompt == null y bgImageUrl == null → continúa con bgImageUrl = undefined
```

Si `suggested_asset_url = null` AND `image_generation_prompt = null` AND `hook = null`, entonces `replicatePrompt = null` y `bgImageUrl = null`. El render continúa:

```typescript
const buffer = await renderStory({ layoutName, idea, brand, bgImageUrl: bgImageUrl ?? undefined });
// bgImageUrl = undefined → renderStory recibe undefined → renderiza sin imagen de fondo
```

El PNG resultante es un **template con texto superpuesto sobre fondo vacío/color del template**, no una foto de fondo. Se sube a Storage, `rendered_image_url` se rellena → story marcada como `rendered` con `render_status = 'rendered'`.

**Este comportamiento existía pre-Fase 4 y sigue igual post-Fase 4.** El render siempre procede aunque no tenga imagen de fondo.

---

### Hipótesis 4: Claude falla silenciosamente sin activar `generation_fallback`

**CONFIRMADA — CAUSA RAÍZ.**

Esta es la hipótesis que explica el síntoma completo. Traza exacta:

**`generateStoryCreativeContent` — `plan-stories.ts:106-160`**

Claude es llamado y responde con éxito (no exception → no catch → `generation_fallback` no se activa). Pero el JSON devuelto por Claude contiene `"imagePrompt": ""` para todos los slots:

```typescript
return {
  copy,
  imagePrompt: typeof obj.imagePrompt === 'string' ? obj.imagePrompt.trim() : '',
  // ↑ Si Claude devuelve "imagePrompt": "" → imagePrompt.trim() = '' (string vacío)
  isFallback,
};
```

La condición de `isFallback` solo cubre la **validez del copy**:
```typescript
const hasValidCopy = typeof obj.copy === 'string' && obj.copy.trim() !== '';
const isFallback   = !isScheduleVerbatim && !hasValidCopy;
// ↑ NO incluye comprobación de imagePrompt — este es el gap
```

Si Claude devuelve copy válido (no vacío → `hasValidCopy = true`) pero `imagePrompt` vacío:
- `isFallback = false` → `generation_fallback = false` ✓ **coincide con síntoma**
- `imagePrompt = ''` → `imageGenPrompt = !imageUrl && '' ? '' : null` → `null` ✓ **coincide con síntoma**
- `copy` es válido pero posiblemente corto ✓ **coincide con síntoma** (12-29 chars = 3-6 palabras; plausible para prompt con "máx 15 palabras")

**¿Por qué Claude devuelve imagePrompt vacío?**

`buildStoryCreativeBatchPrompt` — `prompts.ts:73-85`:
```typescript
`"imagePrompt" — prompt en INGLÉS para IA de imágenes (Flux Dev, fotorealista, sin texto en imagen, máx 70 palabras):
  Incluye: sujeto + estilo fotográfico + iluminación + mood.`
```

Posibles causas de que Claude devuelva `"imagePrompt": ""`:
1. El brand tiene contexto mínimo (sin `description`, `services` escasos, `brand_voice_doc` corto) → Claude no tiene suficiente información para generar un imagePrompt específico y opta por dejar vacío.
2. El modelo (claude-haiku-4-5-20251001) en ocasiones olvida el campo `imagePrompt` o lo deja vacío para ciertos tipos de slot (`schedule`, `data`).
3. El brand es `sector: gym` o similar y el prompt de ejemplo del Dental/Gym/Restaurante en `prompts.ts:74-79` no cubre bien el sector del brand afectado.

**¿Es regresión de Fase 4?** Casi seguramente **NO**. El comportamiento de Claude para imagePrompt no cambió en Fase 4. Pre-Fase 4, si Claude devolvía `imagePrompt = ''`, se almacenaba `hook = null` — el mismo resultado funcional. La diferencia es que ahora hay una columna explícita `image_generation_prompt` que hace el problema visible.

**Confirmación necesaria:** Query B — si en los días pre-Fase 4 las stories ya tenían `hook IS NULL` (sin prefijo REPLICATE:), el problema es preexistente. Si pre-Fase 4 tenían `hook LIKE 'REPLICATE:%'` y post-Fase 4 tienen `image_generation_prompt IS NULL`, entonces SÍ sería regresión.

---

### Hipótesis 5: el cron reconcile-renders dispara renders de stories no listas

**CONFIRMADA PARCIALMENTE — no es la causa raíz pero sí explica el `rendered = true` a pesar de estar "vacías".**

`reconcile-renders/route.ts` selecciona stories con `render_status IN ('pending_render')` (o `render_failed` con intentos restantes) y llama al endpoint de render. El endpoint de render procede aunque `image_generation_prompt = null` y `suggested_asset_url = null` (ver H3). Resultado: la story queda `rendered` con imagen de fondo vacía.

El flujo es:
1. `plan-week.ts:277` marca stories como `pending_render` después del INSERT
2. El fire-and-forget del render endpoint puede fallar (timeouts de Vercel) → story queda en `pending_render`
3. El cron `reconcile-renders` la recoge y despacha el render
4. El render produce un PNG sin imagen de fondo y marca `rendered`

Esto es comportamiento correcto del cron. El problema está upstream (paso 1: stories insertadas sin imagePrompt ni pool asset).

---

## Sección 3 — Diagnóstico final

### Causa raíz

**Claude (claude-haiku-4-5-20251001) está devolviendo `"imagePrompt": ""` (string vacío) en su respuesta JSON para los slots de stories de este brand.** Esto no activa el `generation_fallback` (que solo cubre el copy), no genera un prompt en `image_generation_prompt`, y resulta en stories renderizadas sobre fondo vacío.

El render engine no tiene protección contra este caso: renderiza igualmente y marca `rendered` sin imagen de fondo.

### ¿Regresión de Fase 4?

**INDETERMINADO sin Query B.** El análisis de código indica que la lógica de asignación de imagePrompt es semánticamente idéntica antes y después de Fase 4. Si la Query B muestra:
- `legacy_format > 0` en días pre-Fase 4 + `with_prompt = 0` en días post-Fase 4 → **es regresión** (algo sutil rompió la conversión)
- `legacy_format = 0` en días pre-Fase 4 → **es preexistente** (Claude nunca generó imagePrompts para este brand; ahora es visible con la nueva columna)

### Alcance del daño

Todas las stories con `image_generation_prompt IS NULL AND suggested_asset_url IS NULL AND rendered_image_url IS NOT NULL` creadas desde el deploy de Fase 4. Cuantificar con:
```sql
SELECT COUNT(*) FROM content_ideas
WHERE content_kind = 'story'
  AND image_generation_prompt IS NULL
  AND suggested_asset_url IS NULL
  AND rendered_image_url IS NOT NULL
  AND created_at > '2026-04-23T00:00:00Z';  -- ajustar a timestamp del deploy
```

---

## Sección 4 — Fix propuesto

### Fix 1 — Extender `generation_fallback` para cubrir imagePrompt ausente (recomendado)

**Archivo:** `src/lib/agents/stories/plan-stories.ts`

Actualmente `isFallback` solo cubre copy ausente. Ampliar para incluir imagePrompt ausente:

```typescript
// ANTES (plan-stories.ts — try block, parseo del item de Claude):
const isScheduleVerbatim = input.type === 'schedule' && !!input.existingCopy;
const hasValidCopy       = typeof obj.copy === 'string' && obj.copy.trim() !== '';
const isFallback         = !isScheduleVerbatim && !hasValidCopy;

const copy = isScheduleVerbatim
  ? input.existingCopy!
  : (hasValidCopy ? obj.copy.trim() : FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!);

return {
  copy,
  imagePrompt: typeof obj.imagePrompt === 'string' ? obj.imagePrompt.trim() : '',
  isFallback,
};

// DESPUÉS:
const isScheduleVerbatim = input.type === 'schedule' && !!input.existingCopy;
const hasValidCopy       = typeof obj.copy === 'string' && obj.copy.trim() !== '';
const imagePrompt        = typeof obj.imagePrompt === 'string' ? obj.imagePrompt.trim() : '';
const hasImagePrompt     = imagePrompt !== '';
// generation_fallback = true si hay copia de fallback O si falta imagePrompt (ambas señales de calidad reducida)
const isFallback         = (!isScheduleVerbatim && !hasValidCopy) || !hasImagePrompt;

const copy = isScheduleVerbatim
  ? input.existingCopy!
  : (hasValidCopy ? obj.copy.trim() : FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!);

return {
  copy,
  imagePrompt,
  isFallback,
};
```

Esto hace que el badge "Fallback" en la UI también aparezca cuando Claude no generó imagePrompt, lo que alerta al worker de que la story no tiene imagen de fondo potencial.

---

### Fix 2 — No despachar render si no hay fuente de imagen (opcional, más restrictivo)

**Archivo:** `src/lib/agents/strategy/plan-week.ts`

Actualmente todas las stories se marcan `pending_render` independientemente de si tienen imagen:

```typescript
// plan-week.ts:274-278 (ACTUAL):
await db
  .from('content_ideas')
  .update({ render_status: 'pending_render' })
  .in('id', (insertedStories as { id: string }[]).map(s => s.id));
```

Alternativa: solo marcar `pending_render` las stories que tienen fuente de imagen. Las que no tienen imagen quedarían con `render_status = null` hasta que se les asigne una imagen manualmente o se regenere el plan.

```typescript
// PROPUESTA (solo marcar pending_render si hay imagen disponible):
const idsWithImage = storyRows
  .filter((r, i) => r.suggested_asset_url !== null || r.image_generation_prompt !== null)
  .map((_, i) => (insertedStories as { id: string }[])[i]!.id);
const idsWithoutImage = (insertedStories as { id: string }[])
  .map(s => s.id)
  .filter(id => !idsWithImage.includes(id));

if (idsWithImage.length > 0) {
  await db.from('content_ideas')
    .update({ render_status: 'pending_render' })
    .in('id', idsWithImage);
}
if (idsWithoutImage.length > 0) {
  await db.from('content_ideas')
    .update({ render_status: 'render_failed', render_error: 'No image source: no pool asset and Claude returned empty imagePrompt' })
    .in('id', idsWithoutImage);
}
```

> ⚠️ **Tradeoff:** Con Fix 2, las stories sin imagen nunca se renderizarán automáticamente. El worker o cliente tendría que asignar manualmente una imagen y resetear `render_status = 'pending_render'`. En el estado actual del producto esto puede ser demasiado restrictivo — el template-sin-imagen puede ser visualmente aceptable para algunos layouts. Priorizar Fix 1 primero.

---

### Fix 3 — Mejorar el prompt de Claude para forzar imagePrompts no vacíos (complementario)

**Archivo:** `src/lib/agents/stories/prompts.ts`

Añadir instrucción explícita de que `imagePrompt` no puede estar vacío:

```typescript
// ANTES (prompts.ts:73):
`"imagePrompt" — prompt en INGLÉS para IA de imágenes (Flux Dev, fotorealista, sin texto en imagen, máx 70 palabras):`

// DESPUÉS:
`"imagePrompt" — OBLIGATORIO, no puede estar vacío. Prompt en INGLÉS para IA de imágenes (Flux Dev, fotorealista, sin texto en imagen, máx 70 palabras). Si no tienes información suficiente, usa un prompt genérico para el sector.`
```

Y añadir un fallback de imagePrompt para cada sector en los ejemplos del prompt.

---

## Sección 5 — Plan de remediación de datos

### Stories ya afectadas (post-deploy Fase 4)

Las stories en estado `rendered` sin imagen de fondo no se pueden "arreglar" automáticamente sin re-renderizarlas. Opciones:

**Opción A — Re-generar el plan completo (recomendada si el plan no está confirmado)**
```sql
-- Marcar el plan como needs_review para que el worker lo regenere
UPDATE weekly_plans
SET status = 'ideas_ready'
WHERE id = '{plan_id_afectado}'
  AND status = 'client_reviewing';
```

**Opción B — Resetear render de stories afectadas para que el endpoint intente de nuevo**

Esta opción solo tiene sentido si se aplica Fix 1 + Fix 3 primero (para que Claude genere imagePrompts). Luego:
```sql
-- Resetear render_status de stories sin imagen de fondo
UPDATE content_ideas
SET render_status = 'pending_render',
    rendered_image_url = NULL,
    render_error = NULL,
    render_attempts = 0
WHERE content_kind = 'story'
  AND image_generation_prompt IS NULL
  AND suggested_asset_url IS NULL
  AND rendered_image_url IS NOT NULL
  AND created_at > '2026-04-23T00:00:00Z';
```

⚠️ Solo ejecutar después de aplicar Fix 3 (prompt mejorado), o las historias se re-renderizarán igualmente sin imagen.

**Opción C — Asignar imagen manualmente a cada story**

Para planes de alto valor donde el cliente ya está revisando, asignar `suggested_asset_url` manualmente desde `media_library` o `inspiration_references` del brand, luego resetear `render_status`:
```sql
UPDATE content_ideas
SET suggested_asset_url = '{url_imagen}',
    render_status = 'pending_render',
    rendered_image_url = NULL,
    render_attempts = 0
WHERE id = '{story_idea_id}';
```

---

## Sección 6 — Cronología recomendada

1. **Ejecutar Query B** — confirmar si es preexistente o regresión.
2. Si es regresión: buscar qué cambio específico de Fase 4 afecta la llamada a Claude (revisar git diff de `plan-stories.ts` antes y después).
3. Si es preexistente: implementar Fixes 1 + 3 para hacer el problema observable y reducir su frecuencia.
4. Fix 2 es optativo y conservador — discutir con el equipo antes de aplicar.
5. Remediar datos según Opción A/B/C dependiendo del estado de los planes afectados.
6. Añadir checks al verify script de Fase 4 para `generation_fallback` también cuando `imagePrompt` está vacío.

---

## Resumen ejecutivo

| Elemento | Conclusión |
|---|---|
| ¿Es regresión de Fase 4? | Indeterminado por código — Query B necesaria para confirmar |
| Causa raíz probable | Claude devuelve `imagePrompt: ""` para este brand; `isFallback` no lo captura |
| ¿Pérdida de datos? | No — stories con copy y template existen; falta imagen de fondo |
| Fix mínimo | Extender `isFallback` para cubrir imagePrompt ausente (Fix 1) |
| Fix de fondo | Mejorar prompt para que Claude no devuelva imagePrompts vacíos (Fix 3) |
| Reglas de render | Sin cambios necesarios — el render sin imagen es comportamiento válido |
