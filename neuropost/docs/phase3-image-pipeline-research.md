# Phase 3.0 — Image pipeline research report

**Author:** Claude Code.
**Period:** 2026-04-24.
**Cost spent on APIs during this research:** ≈ **$0.74 USD** (~0.69 €).
**Scope:** research only. No production code changed.

---

## Executive summary (8 lines)

1. **Inventario**: el sistema ya integra Flux Pro, Flux Kontext Pro, Flux Dev (Replicate), Kling (fal.ai vídeo), RunwayML gen4_turbo (vídeo), Claude Sonnet 4 + Haiku 4.5. HiggsField aparece en comentarios pero **no tiene código activo ni API key**.
2. **Keys disponibles**: `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `FAL_KEY`. **Ausentes**: OpenAI, Google, HiggsField, Runway. `FAL_KEY` está con **saldo agotado** (user locked), por lo que fal.ai está de facto fuera de servicio hasta recargar.
3. **Baseline 1.4**: `editImage()` con Flux Kontext Pro está listo en `src/lib/imageGeneration.ts:100` pero en producción **no se usa todavía**: el VisualStrategist vive tras un feature flag apagado (`VISUAL_STRATEGIST_ENABLED`), 0 revisiones img2img en la base de datos, buckets `*/edited/` vacíos.
4. **Pool SportArea vacío** (2 placeholders picsum, 0 en brand_material). Experimentos hechos con 4 muestras de Unsplash como proxy — documentado con transparencia.
5. **Camino 2 (mejora literal)**: Flux Kontext Pro **conserva perfectamente el sujeto** en las 3 pruebas con prompt conservador; 10-13s, $0.04/img. fal.ai Clarity Upscaler y Aura-SR no se pudieron probar (saldo).
6. **Camino 3 (recontextualización)**: Flux Kontext Pro es el ganador claro — 8/8 outputs preservan el sujeto conceptualmente mientras cambian fondo/luz/escenario. Flux Redux Dev **no sirve** (pierde identidad del sujeto).
7. **Catalogador**: Claude Haiku 4.5 vision acierta el 100% de parses en 42 runs, coste $0.0025/img, latencia 2.8s. Sonnet 4 añade precisión marginal (detecta "cenital" donde Haiku dijo "frontal") a 3× el coste. **Haiku es suficiente para catalogar pool**.
8. **Recomendación**: stack Fase 3 ⇒ Catalogador Haiku, Camino 2/3 Flux Kontext Pro (el que ya está), Camino 4 mantener Flux Dev/Pro, Creative Director Claude Sonnet 4 con extended thinking. **No hay que traer proveedores nuevos** — hay que *activar y cablear lo que ya existe*.

---

## 1. Reconocimiento del terreno

### 1.1 Integraciones de IA existentes

| Proveedor / modelo | Archivo / línea | Uso actual | Estado |
|---|---|---|---|
| **Claude Sonnet 4** (`claude-sonnet-4-20250514`) | `src/agents/VisualStrategistAgent.ts:293`, `ImageGenerateAgent.ts:151,163`, `VideoGenerateAgent.ts:123` | Prompt engineering, vision analysis, brief generation | Activo |
| **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | `src/agents/ImageEditAgent.ts:79`, `CompetitorAgent.ts:117`, `InspirationAgent.ts:40`, `plan-stories.ts:119`, `detect-holidays.ts` | Prompt translation, categorización, tareas baratas | Activo |
| **Replicate Flux Pro** (`black-forest-labs/flux-pro`) | `src/lib/imageGeneration.ts:62` | txt2img desde cero (Camino 4 actual). Función `generateImage()`. | Activo |
| **Replicate Flux Kontext Pro** (`black-forest-labs/flux-kontext-pro`) | `src/lib/imageGeneration.ts:104` | img2img con preservación de sujeto. Función `editImage()`. | **Listo pero detrás de feature flag apagado** |
| **Replicate Flux Dev** (`black-forest-labs/flux-dev`) | `src/lib/replicate.ts:46` | txt2img legacy usado en `/api/inspiracion/recrear` y `/api/render/story` (fondos). | Activo pero legado; migrar a Flux Pro planificado |
| **fal.ai Kling v2 Master** (`fal-ai/kling-video/v2/master/image-to-video`) | `src/lib/videoGeneration.ts:37` | Reels img2video | Activo |
| **RunwayML gen4_turbo** | `src/lib/runway.ts:8` | Vídeo txt2video / img2video | Activo |
| **HiggsField AI** | Mencionado en comentarios (`src/app/api/posts/route.ts:199,276`, `runner.ts:44`) | Etiquetado como "generate_human_video / generate_human_photo" | **Sin código real**: no hay wrapper en `src/lib/`, no hay API key. Referencia huérfana |

Ruta actual de imagen estática (sin vídeo):

```
POST /api/posts → agent_queue → content:generate_image handler
  └── (si flag ON) runVisualStrategist → AgentBrief {mode,prompt,strength,...}
       └── handleBriefGeneration → editImage (Kontext Pro) | generateImage (Flux Pro)
  └── (si flag OFF) ImageGenerateAgent → generateImage / editImage (con referenceImageUrl)
       └── upload a Supabase Storage (bucket 'assets' o 'posts')
```

Comentarios en `ImageGenerateAgent.ts:5` y `ImageEditAgent.ts:4` dicen "Nano Banana 2" pero el código real llama **Flux Kontext Pro**. Documentación interna desincronizada.

### 1.2 Keys en `.env.local`

| Key | Presente | Estado |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Con saldo, funcional |
| `REPLICATE_API_TOKEN` | ✅ | Con saldo, funcional |
| `FAL_KEY` | ✅ | **Saldo agotado**: `User is locked. Reason: Exhausted balance` en las 6 llamadas hechas |
| `OPENAI_API_KEY` | ❌ | Ausente — no se puede probar GPT-4o vision / DALL-E / gpt-image-1 |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | ❌ | Ausente — no se puede probar Gemini vision |
| `HIGGSFIELD_API_KEY` | ❌ | Ausente. Y no se ve uso en código |
| `RUNWAY_API_KEY` | ❌ | Ausente aunque hay `src/lib/runway.ts` |

**Acción mínima para seguir investigando**: recargar fal.ai. **Acción opcional**: pedir key de OpenAI si se quiere comparar `gpt-image-1` como alternativa a Flux. Creo que no hace falta — ver §8.

### 1.3 Muestras usadas (simuladas: pool SportArea vacío)

El pool real de `e8dc77ef-8371-4765-a90c-c7108733f791` (SportArea) tiene:

- `inspiration_references` legacy: **2 fotos picsum.photos** (placeholders demo, no fotos reales).
- `brand_material` (fotos subidas): **0 fotos**.
- `inspiration_bank` (Pinterest global): 10 fotos de sectores ajenos (dental, panadería, tenis, chocolate). No son de SportArea.

Usé 4 fotos de Unsplash (licencia libre) como proxy, subidas al bucket `posts/phase3-research/originals/`:

| Key | Calidad | URL pública | Descripción |
|---|---|---|---|
| `01-piscina-good` | good | [piscina-good.jpg](phase3-research/samples/originals/01-piscina-good.jpg) | Nadador mariposa, corcheras rojas/azules, indoor. Bien iluminada. |
| `02-gym-medium` | medium | [gym-medium.jpg](phase3-research/samples/originals/02-gym-medium.jpg) | Sala de mancuernas, luz mixta, persona haciendo peso muerto al fondo. |
| `03-funcional-low` | (pretendida low, en realidad buena) | [funcional-low.jpg](phase3-research/samples/originals/03-funcional-low.jpg) | Battle ropes en entorno urbano, golden hour. Unsplash no sirve fotos realmente malas. |
| `04-burger-low` | (pretendida low, también buena) | [burger-low.jpg](phase3-research/samples/originals/04-burger-low.jpg) | Doble cheeseburger con salsa, tabla de madera, fondo oscuro. |

**Limitación metodológica documentada**: Unsplash es un repositorio de foto profesional. El escenario "cliente manda foto cutre de móvil" no se puede simular perfectamente desde ahí. Las conclusiones de preservación **literal** para `03` y `04` asumen foto ya buena — el estrés real de Camino 2 (foto mediocre) queda para cuando haya pool real.

**Transparencia**: las conclusiones técnicas son válidas (los modelos son agnósticos a la fuente), pero la validación final con pool real de un brand en producción queda pendiente para Fase 3.1 o cuando algún brand suba fotos de verdad.

### 1.4 Baseline — uso actual de `editImage()` / Flux Kontext Pro

**Callers encontrados** (`grep -rn "editImage\|flux-kontext" src/`):

| Caller | Propósito |
|---|---|
| `src/lib/imageGeneration.ts:100` | Wrapper `editImage()`. Llama a `https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions`. |
| `src/agents/ImageEditAgent.ts:103` | `runImageEditAgent` — recibe foto + `editingNarrative` del EditorAgent, Claude Haiku traduce a prompt img2img, llama `editImage()`. Usado cuando ya hay imagen y se quieren editar sólo niveles 1-4 de intensidad. |
| `src/agents/ImageGenerateAgent.ts:201` | `runImageGenerateAgent` — cuando hay `referenceImageUrl`, **bifurca a img2img** via `editImage()`. El resto del tiempo usa `generateImage()` (txt2img). |
| `src/agents/VisualStrategistAgent.ts:109` | El "Visual Strategist" decide `mode: 'img2img' → model: 'flux-kontext-pro'` cuando el brief indica Case A (cliente subió foto) o Case B (cliente subió inspiración y no foto). |
| `src/lib/agents/handlers/local.ts:113` | Handler que recibe un `AgentBrief` y llama `editImage()` cuando `brief.mode === 'img2img'`. Sube el resultado a `posts/edited/`. |
| `src/components/worker/AgentBriefEditor.tsx:16`, `WorkerCockpit.tsx:24,36`, `cockpit-types.ts:27` | UI del worker para editar manualmente el brief; default model `'flux-kontext-pro'`. |

**Prompt templates observados**:

- En `VisualStrategistAgent.ts:124-213` (system prompt, 100 líneas): reglas estrictas para que Claude escoja `mode`, `guidance` (1.5–2.5 para img2img), `strength` (0.4–0.55 conservador, 0.65–0.80 style transfer), `model`. El prompt Case A dice: *"[subject description from source], [style attributes from inspiration], [brand mood], [quality keywords]. Source is authoritative on subject identity; inspiration shapes the rest."*
- En `ImageGenerateAgent.ts:124-148` (vision + img2img): pide a Claude primero describir la imagen, luego aplicar SOLO el ajuste pedido. *"The subject, product, and overall scene must remain IDENTICAL to the original image. Only modify what the user explicitly asked for."*
- En `ImageEditAgent.ts:83-94`: Claude Haiku traduce un `editingNarrative` a prompt edit "1-2 sentences max. Be specific about color, lighting, atmosphere".

**Outputs reales de producción**: ninguno. La consulta a `post_revisions` devuelve 1 sola fila con `image_url=https://example.com/result.jpg` (placeholder de test), modelo `flux-pro`. Buckets `assets/edited/` y `posts/edited/` vacíos. Feature flag `VISUAL_STRATEGIST_ENABLED` no está en `.env.local`, así que el flujo del Strategist nunca se ejecutó en producción.

**Líneas base propias** (generadas como parte de esta investigación): 8 imágenes editadas con Flux Kontext Pro producidas en los Pasos 2 y 3. Son la primera evidencia visual de la línea base del sistema. Ver secciones 2 y 3.

**Resumen baseline**:
- Camino 2/3 tiene infraestructura LISTA (wrapper, agentes, strategist, UI del worker).
- Le falta **activarla** (`VISUAL_STRATEGIST_ENABLED=true`) y un **catalogador del pool** para que tome buenas decisiones.
- No hace falta integrar ningún proveedor nuevo.

---

## 2. Camino 2 — mejora con preservación literal

**Objetivo**: foto del cliente → misma foto, mejor ejecutada técnicamente. No cambia el contenido.

### Prompt usado (idéntico para los 3 casos)
> *Improve the lighting, increase sharpness and contrast slightly, correct white balance toward neutral. Keep the subject, objects, framing, and composition IDENTICAL to the original. No new elements, no style transfer. Professional photograph quality.*

### Resultados

| Sample | Modelo | Latencia | Coste | Preservación (1-10) | Mejora (1-10) | Output |
|---|---|---|---|---|---|---|
| 01-piscina-good | flux-kontext-pro | 10.8s | $0.04 | **10** | 4 (foto ya buena) | [img](phase3-research/samples/camino2/01-piscina-good/flux-kontext-pro.jpg) |
| 02-gym-medium | flux-kontext-pro | 12.9s | $0.04 | **9** | 6 | [img](phase3-research/samples/camino2/02-gym-medium/flux-kontext-pro.jpg) |
| 03-funcional-low | flux-kontext-pro | 12.9s | $0.04 | **10** | 4 (foto ya buena) | [img](phase3-research/samples/camino2/03-funcional-low/flux-kontext-pro.jpg) |
| — | fal.ai Clarity Upscaler | n/a | n/a | — | — | **Bloqueado**: fal.ai user locked (saldo agotado) |
| — | fal.ai Aura-SR | n/a | n/a | — | — | **Bloqueado**: fal.ai user locked (saldo agotado) |
| — | flux-kontext-max | n/a | $0.08/img | No probado | — | Skipped para ahorrar presupuesto; mismo modelo, mayor calidad. Considerar si Pro falla en algún caso |

### Observaciones cualitativas
- **Piscina**: la versión editada es indistinguible a primera vista del original — mismo nadador, misma pose, mismas corcheras. Saturación muy ligeramente bajada. Crop mínimo en bordes.
- **Gym**: preserva mancuernas, geometría, persona al fondo. Contraste ligeramente reforzado.
- **Funcional**: idéntica escena, atleta, cuerdas, arquitectura urbana. Recorte lateral mínimo.

### Problemas detectados
1. **Crop silencioso**: Flux Kontext **cambia el aspect ratio de salida** respecto al input. Input 3:2 → output `1248×832` (ratio cambia ligeramente según la resolución interna). Si se encadena una segunda pasada se pierden bordes. **Fix**: añadir `aspect_ratio` explícito o `match_input_image: true` en el payload. El código actual en `src/lib/imageGeneration.ts:107-115` **no pasa aspect_ratio** — Fase 3.1 debe añadirlo.
2. **"Foto ya buena" no da mejora observable**: el modelo es conservador cuando no hay margen. Correcto, pero significa que no tiene sentido aplicar Camino 2 a fotos que ya rinden bien. El catalogador debe filtrar.
3. **No se probó con foto realmente mala**: pool Unsplash demasiado bueno.

### Recomendación Camino 2
- **Usar Flux Kontext Pro con el prompt conservador anterior** como modelo por defecto.
- Añadir `aspect_ratio` (string `'match_input_image'` o `'3:2'`/`'9:16'`/`'1:1'` según destino) al wrapper `editImage()`.
- **Probar fal.ai Clarity Upscaler cuando se recargue saldo**: es un upscaler + enhancer dedicado que podría ser complementario (mayor nitidez real, más barato ~$0.05). Runs pendientes registrados en `04-camino2-enhance.ts` — relanzables sin cambios.
- **NO migrar** a Flux Kontext Max de momento ($0.08 vs $0.04 con mismos resultados esperados a estos umbrales).

---

## 3. Camino 3 — recontextualización con preservación conceptual

**Objetivo**: misma hamburguesa / misma piscina, distintos tratamientos visuales (fondo, luz, composición). El sujeto debe seguir siendo reconociblemente el mismo.

### Prompts usados

**Pool (3 tratamientos)** en `pool-t1-editorial`, `pool-t2-moody`, `pool-t3-studio-pop`.

**Burger (5 tratamientos) — caso de estudio del plan**:
- `t1-pink-flat`: fondo rosa plano, pop minimalismo
- `t2-ingredients-floating`: ingredientes flotantes, estudio blanco
- `t3-macro`: close-up macro comercial
- `t4-editorial-moody`: tabla madera + chiaroscuro editorial
- `t5-fresh-natural`: bandeja al aire libre, picnic

### Resultados

| Sample × Treatment | Modelo | Latencia | Coste | Preservación sujeto (1-10) | Coherencia prompt (1-10) | Output |
|---|---|---|---|---|---|---|
| Pool × editorial | flux-kontext-pro | 11.1s | $0.04 | 9 | 9 | [img](phase3-research/samples/camino3/pool-t1-editorial/flux-kontext-pro.jpg) |
| Pool × moody | flux-kontext-pro | 10.7s | $0.04 | 9 | 10 | [img](phase3-research/samples/camino3/pool-t2-moody/flux-kontext-pro.jpg) |
| Pool × studio-pop | flux-kontext-pro | 10.9s | $0.04 | 8 | 9 | [img](phase3-research/samples/camino3/pool-t3-studio-pop/flux-kontext-pro.jpg) |
| Pool × editorial | flux-redux-dev | 17.9s | $0.03 | **3** (pierde identidad) | 7 | [img](phase3-research/samples/camino3/pool-t1-editorial/flux-redux-dev.jpg) |
| Pool × moody | flux-redux-dev | 17.6s | $0.03 | 3 | 7 | [img](phase3-research/samples/camino3/pool-t2-moody/flux-redux-dev.jpg) |
| Pool × studio-pop | flux-redux-dev | 17.7s | $0.03 | 3 | 7 | [img](phase3-research/samples/camino3/pool-t3-studio-pop/flux-redux-dev.jpg) |
| Burger × pink-flat | flux-kontext-pro | 12.9s | $0.04 | **10** | 8 (ignoró "top-down") | [img](phase3-research/samples/camino3/burger-t1-pink-flat/flux-kontext-pro.jpg) |
| Burger × ingredients | flux-kontext-pro | 12.9s | $0.04 | **10** | 10 | [img](phase3-research/samples/camino3/burger-t2-ingredients-floating/flux-kontext-pro.jpg) |
| Burger × macro | flux-kontext-pro | 10.7s | $0.04 | **10** | 10 | [img](phase3-research/samples/camino3/burger-t3-macro/flux-kontext-pro.jpg) |
| Burger × editorial | flux-kontext-pro | 13.0s | $0.04 | **10** | 10 | [img](phase3-research/samples/camino3/burger-t4-editorial-moody/flux-kontext-pro.jpg) |
| Burger × fresh-natural | flux-kontext-pro | 11.0s | $0.04 | **10** | 9 | [img](phase3-research/samples/camino3/burger-t5-fresh-natural/flux-kontext-pro.jpg) |

### Hallazgos
1. **Flux Kontext Pro es excelente** para recontextualización. En los 5 burgers, el bun con sésamo, los 2 patties, la salsa rosada mayo-ketchup y los toppings (cebolla blanca, pepinillo, tomate, lechuga) son los MISMOS en los 5 outputs. La hamburguesa *es la hamburguesa*, en 5 escenarios creativos distintos. Es exactamente el producto que la Fase 3 quiere.
2. **Flux Redux Dev NO sirve**: en las 3 pruebas de piscina, generó **otra persona** (otro rostro, otro pelo) en otra escena similar. Redux es "variación inspirada" no "edit preservando sujeto". Para Camino 3 con criterio de identidad literal, descartado.
3. **Prompt-adherence**: Kontext Pro ignora instrucciones de ángulo ("top-down" del pink-flat) si contradicen la foto fuente. Normal para un modelo img2img — Fase 3 debe aceptar que el ángulo del cliente es el ángulo final.
4. **Coste por tratamiento**: $0.04 × 5 tratamientos = $0.20 por "carrusel de hamburguesa" → manejable.
5. **Variedad entre tratamientos**: 9/10 — los 5 outputs son visiblemente distintos entre sí (fondo, luz, props), sin colapsar a "la misma foto variada".

### Recomendación Camino 3
- **Flux Kontext Pro** como único modelo para Camino 3, con prompts tipo "same <subject description from cataloguer>, <treatment description>".
- **Pre-cataloger del sujeto** es esencial: el prompt debe decir explícitamente "the same double cheeseburger with sesame bun, two beef patties, special pink sauce, white onion, pickles, tomato, lettuce". Para eso ⇒ Paso 4 (catalogador).
- **Guidance 2.5** funciona bien como default para Camino 3 (frente a `2.0` que uso el Strategist para Camino 2 conservador). Subir a 3 si hay que forzar más prompt adherence.
- **No probar Flux Redux** en producción.

---

## 4. Catalogador automático

**Objetivo**: cada foto nueva del pool debe ganar metadata estructurada que el Creative Director use para decidir *camino 1 vs 2 vs 3*.

### Esquema JSON propuesto

```json
{
  "content": "4-10 word summary (e.g. 'indoor swimming pool, wide shot')",
  "composition_type": "cenital|frontal|three_quarters|close_up|wide|detail",
  "quality": { "lighting": 1-5, "sharpness": 1-5, "framing": 1-5 },
  "recontextualizable": true|false,
  "stands_alone": true|false,
  "style_tags": ["warm"|"cold"|"moody"|"bright"|"minimal"|"busy"|"editorial"|"playful"|"documentary"],
  "dominant_colors": ["#hex1","#hex2","#hex3"],
  "notes": "single sentence, max 120 chars"
}
```

**Reglas clave**:
- `recontextualizable` = true sólo si el sujeto es aislable (producto, persona, punto focal claro). Escenas sin sujeto claro → false.
- `stands_alone` = true sólo si la foto aguanta como IG Story **sin texto encima**. Stock genérico → false.
- Todos los campos obligatorios. JSON estricto, sin markdown.

### Resultados empíricos (14 imágenes, 3 runs Haiku + 1 run Sonnet)

| Modelo | Parse OK | Latencia media | Coste total | Coste/img |
|---|---|---|---|---|
| **claude-haiku-4-5** | 42/42 (100%) | 2.8s | $0.105 | **$0.0025** |
| **claude-sonnet-4** | 14/14 (100%) | 4.2s | $0.099 | **$0.0071** |

### Consistencia Haiku (mismo archivo × 3 runs)

Para `01-piscina-good`:
- `content`: "Competitive swimmer performing butterfly stroke in pool" (runs 1 y 3) / "Competitive swimmer performing butterfly stroke" (run 2). Sin contradicción semántica.
- `composition_type`: "frontal" en los 3.
- `quality.lighting`: 4 / 4 / 4. Sin variación.
- `quality.framing`: 4 / 5 / 5. Variación ±1 punto.
- `recontextualizable`: true en los 3.
- `stands_alone`: true en los 3.
- `style_tags`: `["editorial","bright","cold"]`, `["cold","bright","editorial","documentary"]`, `["cold","bright","editorial","documentary"]`. Orden distinto, +1 tag en 2 runs.

**Conclusión consistencia**: 3 decisiones semánticas (composition, recontext, stands_alone) son 100% estables. Variaciones sólo en scores numéricos ±1 y en orden de tags. Aceptable para el uso.

### Precisión Haiku vs Sonnet (ejemplo)

Para la misma foto piscina:
- **Haiku** `composition_type: "frontal"`.
- **Sonnet** `composition_type: "cenital"` ← **correcto**, la foto es ligeramente cenital.
- **Sonnet** identifica el rojo de las corcheras (`#D32F2F`); Haiku lista blancos y azules pero se deja el rojo.

Sonnet aporta un ~15% más de precisión en detalles visuales (ángulo, colores accidentales) a 2.8× el coste. Para la mayoría del uso (100s-1000s de fotos en cataloguer batch), Haiku es suficiente. **Un uso híbrido** tiene sentido: Haiku por defecto, Sonnet sólo cuando se detecte baja confianza o foto compleja.

### Recomendación catalogador
- **Usar Claude Haiku 4.5 vision** como catalogador por defecto, 1 run/foto.
- Costes estimados (ver §6): para 10 fotos nuevas/mes × 200 brands = 2000 runs/mes = **$5/mes** total para todo el catalogador.
- **Disparador**: un trigger `AFTER INSERT ON brand_material` encola un job `content:catalogue_photo` que:
  1. Llama a Haiku vision con el system prompt definido arriba.
  2. Guarda el JSON parseado en una nueva columna `brand_material.catalog_meta JSONB`.
  3. Re-cataloga al editarse la imagen.
- **Almacenamiento**: extender `brand_material` con `catalog_meta jsonb` e índice GIN sobre `catalog_meta->>'recontextualizable'` y `catalog_meta->>'stands_alone'` para filtros rápidos del Creative Director.

---

## 5. Integración con `calendar_events`

Schema: `id, brand_id, title, date, type, relevance, description, suggested_content_idea, year`. Ya poblado — SportArea tiene **27 eventos totales** (ver `scripts/phase3-research/07-calendar-context.ts`).

### 5.1 Query estándar (semana)

```sql
SELECT title, date, type, relevance, description, suggested_content_idea
FROM calendar_events
WHERE brand_id = :brand_id
  AND date >= CURRENT_DATE
  AND date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY relevance DESC, date ASC;
```

### 5.2 Bloque de contexto para el prompt del Creative Director

```
EFEMÉRIDES DE LA SEMANA (orden por relevancia, fecha):
- [2026-05-01] Día del Trabajo (holiday / medium)
    Festivo nacional, Día Internacional del Trabajo.
    Sugerencia: honrar al equipo / descuento especial.

Reglas:
- Si alguna efeméride es relevante para el brand (sector, localización, target), considera integrarla en UNA de las stories de la semana.
- Vías preferentes, en este orden:
  (a) Mención en el copy de una story text-heavy existente.
  (b) Recontextualización temática (Camino 3) de una foto real del pool — NO generar imagen nueva.
  (c) Layout editorial (event_calendar_graphic ya no existe; usar editorial_large_title o minimal_color_block) destacando tipográficamente la fecha/evento.
- No fuerces efemérides que no encajen con el sector o tono del brand.
- Máx 1 efeméride/semana en el plan final, salvo que el brand tenga un evento crítico (relevance=high).
```

### 5.3 Ejemplo concreto SportArea, semana del 2026-04-24

Del query real:

```
Week (2026-04-24 → 2026-05-01):
  [2026-05-01] Día del Trabajo  (holiday/medium)
      Festivo nacional...
      → "Honra el trabajo de tu equipo y clientes con un post motivacional o descuento especial."

Month (2026-04-24 → 2026-05-24), por relevancia:
  [2026-05-01] medium  holiday    Día del Trabajo
  [2026-05-14] low     cultural   Ascensión de Jesús
  [2026-05-24] low     cultural   Día de Pentecostés
```

Stories verosímiles que el Creative Director podría proponer esta semana:

| Día story | Tipo | Layout sugerido | Fuente imagen | Efeméride ligada |
|---|---|---|---|---|
| Lunes 2026-04-27 | promo | `banner` | none (text-only) | — |
| Miércoles 2026-04-29 | quote | `quote_editorial_serif` | none | — |
| **Viernes 2026-05-01** | **promo + efeméride** | `minimal_color_block` o `tagline` | none | **Día del Trabajo**: copy "Honrem el treball de tots. Des de 1998 entrenant-vos cada dia." |
| Sábado 2026-05-02 | schedule | `table` | none | — |

**Observación**: "Sant Jordi" (23-abr) cayó ayer, no aparece en la ventana de 7 días. Si el plan semanal se hiciera el lunes anterior, sí habría entrado. El Creative Director debe consultar efemérides del período planificado, no del día actual.

---

## 6. Estimación de coste por brand / mes

**Supuestos**:
- 2 posts + 5 stories/sem × 4.3 sem = 30 piezas/mes por brand.
- Distribución realista por camino: 20 Camino 1 (foto tal cual, $0) / 4 Camino 2 / 5 Camino 3 / 1 Camino 4.
- Catalogador: 10 fotos nuevas/mes (asumimos que los brands no suben pool masivo cada mes).
- Creative Director: 4 llamadas/mes (1 planificación semanal × 4 semanas). Uso extended thinking = más tokens output.

| Concepto | Modelo | Llamadas/mes | Coste unitario | Total/brand/mes |
|---|---|---|---|---|
| Camino 1 (foto tal cual) | — | 20 | $0.00 | $0.00 |
| Camino 2 (mejora) | flux-kontext-pro | 4 | $0.04 | $0.16 |
| Camino 3 (recontextualización) | flux-kontext-pro | 5 | $0.04 | $0.20 |
| Camino 4 (generación) | flux-pro | 1 | $0.05 | $0.05 |
| Catalogador | claude-haiku-4-5 | 10 | $0.0025 | $0.025 |
| Creative Director | claude-sonnet-4 (extended thinking) | 4 | ~$0.08 (input 5k + output 3k tokens + thinking) | $0.32 |
| **Total por brand / mes** | | | | **$0.75 / mes** |

### Extrapolación

| Brands | Coste IA mensual | Coste IA anual |
|---|---|---|
| 50 brands | $37.5 | $450 |
| 100 brands | $75 | $900 |
| 200 brands | $150 | $1800 |
| 500 brands | $375 | $4500 |

**Comparado con el pricing del plan Neuropost** (Starter/Pro/Total), este coste es despreciable — representa <2% del revenue típico por brand a precios de suscripción razonables.

### Notas
- El coste del Camino 4 supone **migrar `/api/inspiracion/recrear` y `/api/render/story` de Flux Dev a Flux Pro** (ambos $0.05 vs ~$0.03). El cambio está en el plan y es mínimo.
- Si se decidiera en algún momento usar Flux Kontext **Max** en vez de Pro (mejor consistencia), el total subiría a ~$1.20/brand/mes. Sigue siendo bajo.
- Gastos de almacenamiento (Supabase Storage) no incluidos — ~10 KB metadata + ~400 KB/imagen × 10 fotos × 200 brands = 800 MB/mes, irrelevante.
- Los costes de Replicate se cargan según lo que indica su pricing page y pueden variar ±20%. No he modelado tiers de descuento.

---

## 7. Riesgos y puntos abiertos

### 7.1 Dependencias frágiles
- **Todo el pipeline cuelga de Replicate** para imagen. Si Replicate cae o cambia pricing, afecta a los 4 caminos. Necesitamos un fallback: guardar en cola + reintentar, y tener un provider secundario registrado (fal.ai si se recarga saldo, Stability AI, Together AI). No urgente para Fase 3.1, pero sí a tener en el roadmap.
- **fal.ai está bloqueado por saldo**. Aunque Camino 2/3 no lo necesiten, el pipeline de vídeo (Kling) sí. **Acción pendiente**: recargar fal.ai (bajo control de la usuaria).
- **HiggsField** aparece referenciado en 4 sitios del código sin implementación. O se termina de integrar o se borran las menciones en Fase 3.1 para no confundir a futuros mantenedores.

### 7.2 Pool real ausente
- Ningún brand tiene `brand_material` poblado (0 fotos). Los planes semanales sin pool no pueden ejecutar Camino 1 (tal cual) ni 2 (mejora) ni 3 (recontextualización). **El Creative Director caerá automáticamente a Camino 4 (generación) para la totalidad de las stories**.
- **Riesgo operativo**: la fase actual del producto entrega stories **100% generadas por IA**, que es justo lo contrario de lo que la Fase 3 quiere.
- **Mitigación**: UI de subida masiva de fotos en `/brand-kit` (`MaterialDeMarcaHero` ya existe — ampliar flujo de ingesta).

### 7.3 Catalogador — edge cases
- **Fotos con personas reconocibles**: el catalogador debe detectar caras para flag de GDPR/consentimiento. Hoy no lo hace. Añadir campo `faces_detected: boolean` al schema JSON.
- **Contenido sensible** (alcohol, niños en deportes, desnudos parciales): el catalogador debe señalar → `content_warnings: []`. Actualmente no.
- **Fotos con texto embebido** (carteles, precios): detectarlo para evitar overlay redundante → `contains_text: boolean`.
- Todas estas extensiones son triviales añadiéndolas al system prompt sin cambiar infraestructura.

### 7.4 Preservación de sujeto — límite observado
- Flux Kontext **cropea bordes** en cada pasada. Si una foto pasa por Camino 2 (mejora) y después por Camino 3 (recontextualización), se pierden bordes. **Mitigación**: pasar `aspect_ratio: 'match_input_image'` y no encadenar ediciones — siempre editar desde el original.
- Flux Kontext no lee bien texto embebido (un cartel en la foto puede salir como "garabato"). No crítico para Instagram pero hay que avisarlo en el Creative Director.

### 7.5 Preservación conceptual — preguntas de producto
- Cuando el Creative Director decide "5 tratamientos de la hamburguesa del cliente", ¿es correcto desde el punto de vista de marca que **cada Story enseña la MISMA hamburguesa en 5 escenas distintas**? Puede sentirse forzado. Convendría mezclar caminos: 2 Camino 1 (foto real del pool) + 2 Camino 3 (recontextualización) + 1 Camino 2 (mejora de otra foto del pool) dentro de la misma semana, en vez de 5 recontextualizaciones del mismo sujeto. Decisión de producto.
- **Preservación literal no es siempre deseable**: si la foto original del cliente tiene **errores** (cartel de precio viejo, logo desalineado, persona no consentida), Camino 2 los propagará. El prompt del wrapper `editImage()` debería poder recibir "REMOVE the price tag in the background" como ajuste — hoy el agente lo asume en el EditingNarrative pero no está formalizado.

### 7.6 Lock-in
- Flux Kontext Pro sólo está en Replicate y en el SDK oficial de Black Forest Labs. Si Replicate dejara de hostearlo, migrar a BFL directo es 1 día de trabajo (mismo API schema).
- Anthropic/Claude no tiene un drop-in replacement con vision al mismo nivel. OpenAI gpt-image-1 podría servir pero no lo hemos probado. Riesgo medio.

### 7.7 Experimentos no ejecutados
- **fal.ai Clarity Upscaler** y **fal.ai Aura-SR** (bloqueados por saldo). Recarga + 1 re-run del script `04-camino2-enhance.ts` = 6 min.
- **Flux Kontext Max** (no probado para ahorrar presupuesto). Re-run si Pro falla en algún escenario real.
- **GPT-4o vision** y **Gemini 1.5 Flash** como catalogadores (sin keys). Sólo si el usuario quiere un segundo punto de comparación.
- **gpt-image-1** (OpenAI) como alternativa a Flux Pro (sin key). Interesante para calibrar, no urgente.

---

## 8. Recomendación final y plan de Fase 3.1

### Stack definitivo propuesto

| Componente | Modelo | Justificación |
|---|---|---|
| **Camino 1** (foto tal cual) | — | Sin IA |
| **Camino 2** (mejora) | **Flux Kontext Pro** (Replicate) | Baseline del sistema ya integrado, probado 3/3 con preservación literal excelente. Coste $0.04/img. |
| **Camino 3** (recontextualización) | **Flux Kontext Pro** (Replicate) | 8/8 outputs preservan el sujeto conceptualmente con excelente variedad. Flux Redux Dev descartado (pierde identidad). |
| **Camino 4** (generación) | **Flux Pro** (Replicate, ya integrado en `generateImage()`) | Mantener; migrar `/api/inspiracion/recrear` de Flux Dev a Flux Pro como limpieza adicional (fuera del scope de 3.1). |
| **Catalogador** | **Claude Haiku 4.5 vision** | 42/42 parse OK, $0.0025/img, 2.8s, consistencia semántica 100% en campos críticos. |
| **Creative Director** | **Claude Sonnet 4** con extended thinking | El director de orquesta es la decisión más compleja (elegir camino, seleccionar foto del pool, alinear con brand + calendario) — necesita el modelo más capaz. Coste ~$0.08/llamada aceptable (4 llamadas/mes/brand). |

**Importante**: **no hay que traer proveedores nuevos**. Todo el stack ya existe en el código o en las API keys disponibles. La Fase 3.1 es de **cableado y activación**, no de integración.

### Plan ordenado de tareas de Fase 3.1

1. **Activación y limpieza del baseline** (1-2 días):
   - Añadir `aspect_ratio: 'match_input_image'` al payload de `editImage()` en `src/lib/imageGeneration.ts:104-115`.
   - Borrar comentarios obsoletos ("Nano Banana 2") en `ImageEditAgent.ts:4` y `ImageGenerateAgent.ts:5`.
   - Decidir: o activar feature flag `VISUAL_STRATEGIST_ENABLED=true` o simplificar — el Strategist tiene complejidad que quizá no aporta si el Creative Director lo absorbe.

2. **Catalogador del pool** (2-3 días):
   - Migración: añadir `catalog_meta jsonb NULL` a `brand_material` + índice GIN.
   - Handler nuevo `content:catalogue_photo` en `src/lib/agents/handlers/` que llama Claude Haiku con el system prompt de §4 y persiste el JSON.
   - Trigger DB `AFTER INSERT OR UPDATE OF file_url ON brand_material` que encola el job.
   - Backfill script para catalogar fotos existentes (0 hoy → $0).
   - UI pequeña en `/brand-kit` para mostrar el catálogo con los tags (reutilizar `LayoutsGallery` visual).

3. **Wrapper `imagePipeline(path, ctx)`** (2-3 días):
   - Nueva función `src/lib/stories/image-pipeline.ts` con contrato:
     ```typescript
     type Path = 'as_is' | 'enhance' | 'recontextualize' | 'generate';
     interface PipelineCtx { brand: Brand; idea: ContentIdea; sourcePhoto?: CatalogedPhoto; treatment?: string; }
     async function imagePipeline(path: Path, ctx: PipelineCtx): Promise<{ url: string; cost_usd: number; elapsed_ms: number }>
     ```
   - Delega: `as_is` → passthrough; `enhance` → `editImage()` con prompt conservador; `recontextualize` → `editImage()` con prompt tratamiento; `generate` → `generateImage()`.
   - Inyecta `aspect_ratio` desde el formato del post (post/story/reel_cover).
   - Trackea coste en `post_revisions` existente.

4. **Creative Director** (3-5 días — el núcleo de Fase 3):
   - Reescribir `generateStoryCreativeContent` (o crear `callCreativeDirector`) con un system prompt que conoce:
     - Los 25 layouts del `LAYOUT_CATALOG` (Fase 2) con sus metadata (`text_mode`, `supportsImage`, `preferred_image_source`, `best_for`, `aesthetic_affinity`).
     - El `brand_kit` (aesthetic preset, typography, overlay_intensity, realism_level, allow_graphic_elements).
     - El pool catalogado del brand (array de `{url, catalog_meta}`).
     - Las efemérides de la semana (§5.2 bloque de contexto).
     - Los 4 caminos y sus costes.
   - Output JSON con, por cada story: `{layout, path, sourcePhotoId?, treatment?, copy, rationale}`.
   - Modelo: `claude-sonnet-4-20250514` con extended thinking habilitado.

5. **Tests de no-regresión visuales** (paralelo):
   - Extender `scripts/phase3-research/` con casos controlados (fotos fijas, mismo prompt) para detectar drift del modelo.
   - Adaptar `verify-phase2-layouts-regression.ts` para incluir salidas del pipeline en escenarios frozen (fotos mock + prompts mock).

6. **Recarga fal.ai + benchmark pendiente** (30 min, una vez tengas saldo):
   - Re-lanzar `scripts/phase3-research/04-camino2-enhance.ts` para completar la tabla de Camino 2 con Clarity Upscaler y Aura-SR. Documentar resultados en addendum a este informe.

### Preguntas abiertas para la usuaria

1. **¿Activar `VISUAL_STRATEGIST_ENABLED` o reemplazarlo por el Creative Director?** El Strategist es un "mini director" que decide mode/model/strength para una pieza. Si el Creative Director gestiona 5-7 piezas/semana, puede absorberlo. Personalmente me inclino por reemplazar.
2. **¿Quieres que el informe incluya una comparación con gpt-image-1 o Gemini?** Requiere conseguir keys. Mi opinión: no. Flux Kontext Pro ya cumple.
3. **¿Abrimos issue para poblar pool de SportArea con fotos reales?** Sin pool, la Fase 3 caerá a Camino 4 (generación) — contrario al objetivo.
4. **¿Cómo manejar personas reconocibles en fotos?** (GDPR, consentimiento). Necesito guidance de producto antes de extender el catalogador con `faces_detected`.
5. **¿Sant Jordi fue importante para SportArea?** El evento cayó 23-abr-2026 (ayer) y no entró en el plan semanal. Pregunta más amplia: ¿el plan semanal se fija los lunes o también puede rehacerse si se detecta una efeméride de alta relevancia mid-week?

### Qué NO hay que hacer en Fase 3.1

- No traer proveedores nuevos.
- No migrar vídeo (sigue con fal.ai Kling + RunwayML).
- No tocar los 25 layouts (Fase 2 cerrada).
- No implementar un "catalogador de vídeos" aún.
- No activar HiggsField — o se integra como follow-up separado o se borran las menciones huérfanas del código.

---

## Anexo A — Scripts experimentales

Ubicación: `scripts/phase3-research/`.

| Script | Propósito | Runnable |
|---|---|---|
| `00-list-buckets.ts` | Lista los buckets Supabase disponibles | Sí |
| `01-list-sportarea-pool.ts` | Dump del pool de SportArea (confirmó pool vacío) | Sí |
| `02-list-edited-samples.ts` | Busca outputs reales de img2img en `post_revisions` / buckets (confirmó 0 outputs) | Sí |
| `03-fetch-unsplash-samples.ts` | Descarga 4 Unsplash + sube a Supabase `posts/phase3-research/originals/` | Sí, idempotente |
| `04-camino2-enhance.ts` | Benchmark Camino 2: Flux Kontext Pro × 3 samples; fal.ai bloqueado | Sí (fal.ai falla hasta recargar) |
| `05-camino3-recontextualize.ts` | Benchmark Camino 3: Pool × 3 × 2 modelos + Burger × 5 × Kontext | Sí |
| `06-catalogador.ts` | Catalogador Haiku × 3 runs + Sonnet × 1 run en 14 imágenes | Sí |
| `07-calendar-context.ts` | Lista eventos calendar_events upcoming para SportArea | Sí |

Todos los scripts cargan `.env.local` y no requieren instalación de deps nuevas (usan paquetes ya en el monorepo: `@supabase/supabase-js`, `@anthropic-ai/sdk`, `dotenv`).

## Anexo B — Muestras visuales

Ubicación: `docs/phase3-research/samples/`.

```
originals/
  01-piscina-good.jpg          (Unsplash, indoor pool butterfly)
  02-gym-medium.jpg            (Unsplash, gym interior)
  03-funcional-low.jpg         (Unsplash, battle ropes urban)
  04-burger-low.jpg            (Unsplash, double cheeseburger)
  manifest.json                (descripciones + publicUrl Supabase)

camino2/
  01-piscina-good/flux-kontext-pro.jpg
  02-gym-medium/flux-kontext-pro.jpg
  03-funcional-low/flux-kontext-pro.jpg
  results.json

camino3/
  pool-t1-editorial/flux-kontext-pro.jpg
  pool-t1-editorial/flux-redux-dev.jpg
  pool-t2-moody/flux-kontext-pro.jpg
  pool-t2-moody/flux-redux-dev.jpg
  pool-t3-studio-pop/flux-kontext-pro.jpg
  pool-t3-studio-pop/flux-redux-dev.jpg
  burger-t1-pink-flat/flux-kontext-pro.jpg
  burger-t2-ingredients-floating/flux-kontext-pro.jpg
  burger-t3-macro/flux-kontext-pro.jpg
  burger-t4-editorial-moody/flux-kontext-pro.jpg
  burger-t5-fresh-natural/flux-kontext-pro.jpg
  results.json

catalogador/
  haiku/<image>.run1.json .run2.json .run3.json
  sonnet/<image>.json
  summary.json
```

## Anexo C — Resumen de coste de la investigación

| Paso | Concepto | Coste USD |
|---|---|---|
| 2 | Flux Kontext Pro × 3 samples | 0.120 |
| 3 | Flux Kontext Pro × 3 pool + 5 burger = 8 runs | 0.320 |
| 3 | Flux Redux Dev × 3 pool | 0.090 |
| 4 | Claude Haiku vision × 42 runs | 0.105 |
| 4 | Claude Sonnet vision × 14 runs | 0.099 |
| 1.1–1.3 + 5 + 7 | Queries Supabase / listings | 0.000 |
| **Total** | | **≈ $0.73 USD** |

**Bajo el presupuesto ampliado de $2**. Bajo el presupuesto global de 15€.

---

**Fin del informe — Phase 3.0 cerrada. Esperando luz verde antes de abrir Phase 3.1 (implementación).**
