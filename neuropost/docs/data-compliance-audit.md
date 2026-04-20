# NeuroPost — Auditoría de compliance de datos

> **Fecha:** 2026-04-18
> **Alcance:** monorepo `Proyecto_1/` (Next.js `neuropost/` + workspace `backend/agents/`)
> **Foco:** RGPD (arts. 6, 28, 32), flujos PII hacia LLM y proveedores externos, retención y derecho al borrado.
> **Método:** análisis estático. No se auditan contratos firmados fuera del código.

Este informe identifica qué datos personales procesan los agentes, qué pasa cuando un cliente ejerce su derecho al borrado, qué obligaciones RGPD están cubiertas y cuáles no, y lista las acciones concretas a cerrar **antes de aceptar clientes en producción**.

---

## 1. Datos personales que acceden los agentes

### 1.1 CommunityAgent — nivel de riesgo **ALTO**

Procesa comentarios y DMs **de usuarios finales del cliente** (el seguidor / cliente del negocio, no el cliente de NeuroPost). Son terceros que nunca firmaron nada con NeuroPost.

**Campos del schema `Interaction`** ([backend/agents/community/types.ts](backend/agents/community/types.ts), consumidos en [neuropost/src/types/index.ts:598-601](neuropost/src/types/index.ts#L598)):

| Campo | PII | Origen |
|---|---|---|
| `authorId` | Identificador público (Meta user id) | Webhook Meta |
| `authorName` | Nombre público del autor | Webhook Meta |
| `text` | **Contenido literal del comentario/DM** — puede contener email, teléfono, dirección, queja médica, etc. | Webhook Meta |
| `timestamp` | Metadato | Webhook Meta |
| `isVerified` | Metadato | Webhook Meta |

Entrada del webhook: [neuropost/src/app/api/meta/webhook/route.ts:86-114](neuropost/src/app/api/meta/webhook/route.ts#L86). El contenido se persiste en tabla `comments` ([supabase/schema.sql:89-101](neuropost/supabase/schema.sql#L89)) y en `agent_jobs.input` JSONB.

El system prompt del CommunityAgent ([backend/agents/community/prompts.ts:15-49](backend/agents/community/prompts.ts#L15)) contempla `containsSensitiveContent: boolean` en el output, pero el input YA contiene el texto sensible — la detección es posterior.

### 1.2 SupportAgent — nivel de riesgo **ALTO**

Procesa tickets y mensajes de chat **del cliente de NeuroPost**. Hay consentimiento contractual, pero el contenido puede contener datos sensibles (ej. números de teléfono, direcciones, reclamaciones).

**Campos del input** ([backend/agents/support/prompts.ts:192-217](backend/agents/support/prompts.ts#L192)):

- `clientMessage` — mensaje literal del cliente.
- `messageHistory[]` — hasta 10 mensajes anteriores `{ sender, at, message }`.
- `subject`, `priority`, `declaredCategory` — metadatos.
- Contexto inyectado: `businessName`, `sector`, `plan`.

Persistencia: tabla `support_tickets` ([supabase/incidencias_soporte.sql:15](neuropost/supabase/incidencias_soporte.sql#L15)) con `mensaje_original`, `respuesta_agente`, `extracto_mensajes` JSONB.

### 1.3 CopywriterAgent / EditorAgent / PlannerAgent / AnalystAgent — riesgo **MEDIO**

Reciben inputs construidos por el sistema, no texto libre de usuarios finales. PII potencial:
- `businessName` del cliente.
- Métricas agregadas de cuenta IG/FB (no individualizables).
- `brandVoice.exampleCaptions` y `brandVoiceDoc` — pueden contener información personal si el cliente las redactó así.

### 1.4 CreativeExtractorAgent — riesgo **MEDIO**

Analiza posts virales/referencia. El prompt ([backend/agents/creative-extractor/prompts.ts:149](backend/agents/creative-extractor/prompts.ts#L149)) **sí tiene guardrails**: "Never identify real people by name", y tiene un circuit breaker para menores: `If the content depicts minors in any way that could enable harm, return {"error":"content_not_analyzable"}`. Es el único prompt con estas protecciones explícitas.

### 1.5 InspirationAgent — riesgo **BAJO-MEDIO**

Analiza pins públicos de Pinterest. Los pines son contenido público por definición, pero pueden contener caras/nombres. Sin guardrail explícito visible.

### 1.6 Agentes de generación de imagen/vídeo — riesgo **BAJO**

NanoBanana, Runway, Higgsfield, Replicate reciben prompts de texto, no PII directa. El prompt puede contener el nombre del negocio. Riesgo de que el cliente meta una cara real en `imageUrl` (upload propio) existe — **no encontrado en el código** ningún filtro de caras.

---

## 2. DPA firmados con proveedores

### 2.1 Anthropic

- **No encontrado en el código** referencia a DPA, Commercial Terms o ZDR (Zero Data Retention).
- El SDK `@anthropic-ai/sdk` se usa con solo `ANTHROPIC_API_KEY`. **No** se envía header `anthropic-beta` con flags de retención, ni se configura endpoint especial.
- Por defecto Anthropic **retiene inputs 30 días** para abuse monitoring (per su política pública). Para ZDR hay que firmar un contrato específico y configurar el cliente con un header especial — nada de eso está en el repo.

### 2.2 Replicate

- Variables `REPLICATE_API_TOKEN` y `REPLICATE_WEBHOOK_SECRET` en [.env.example:20-27](neuropost/.env.example#L20).
- **No encontrado en el código** referencia a DPA.
- Replicate procesa los prompts + imágenes de referencia en sus GPUs. Política pública: **no entrenan con prompts de usuarios pagos**, pero hay que verificarlo contractualmente.

### 2.3 Runway / Higgsfield / NanoBanana

- No tienen entrada en [.env.example](neuropost/.env.example). Las API keys (`RUNWAYML_API_KEY`, `HIGGSFIELD_API_KEY`, `NANO_BANANA_API_KEY`) existen en runtime según los `lib/*.ts`, pero no están documentadas.
- **No encontrado en el código** ningún DPA ni referencia legal.

### 2.4 Supabase, Vercel, Stripe, Resend, Sentry, Meta

- Proveedores de infraestructura. Todos tienen DPA estándar firmable en sus portales. **No se puede verificar en el código** si están firmados.

### 2.5 Documentos legales de la web NeuroPost

Páginas públicas detectadas:
- [neuropost/src/app/legal/privacidad/page.tsx](neuropost/src/app/legal/privacidad/page.tsx)
- [neuropost/src/app/legal/terminos/page.tsx](neuropost/src/app/legal/terminos/page.tsx)
- [neuropost/src/app/legal/cookies/page.tsx](neuropost/src/app/legal/cookies/page.tsx)
- [neuropost/src/app/legal/aviso-legal/page.tsx](neuropost/src/app/legal/aviso-legal/page.tsx)

El registro tiene checkbox de marketing consent ([auth/register/page.tsx](neuropost/src/app/(auth)/register/page.tsx)) persistido en `auth.user_metadata` ([api/brands/route.ts](neuropost/src/app/api/brands/route.ts)).

**No auditado**: el contenido literal de estas páginas — si listan o no a los subencargados (art. 28.2 RGPD).

---

## 3. Borrado de cuenta y cascadas

### 3.1 Endpoint de borrado

[neuropost/src/app/api/brands/account/route.ts](neuropost/src/app/api/brands/account/route.ts) (método DELETE):

1. `DELETE FROM brands WHERE user_id = auth.uid()` — dispara cascadas.
2. `supabase.auth.signOut()`.
3. `admin.auth.admin.deleteUser(user.id)` — borra `auth.users`.

### 3.2 Cascadas en efecto (`ON DELETE CASCADE` al borrar `brands`)

| Tabla | CASCADE | Fichero |
|---|---|---|
| `posts` | ✅ | [schema.sql:47](neuropost/supabase/schema.sql#L47) |
| `comments` | ✅ | [schema.sql:91](neuropost/supabase/schema.sql#L91) |
| `notifications` | ✅ | [schema.sql:125](neuropost/supabase/schema.sql#L125) |
| `activity_log` | ✅ | [schema.sql:155](neuropost/supabase/schema.sql#L155) |
| `media_library` | ✅ | [schema.sql:186](neuropost/supabase/schema.sql#L186) |
| `agent_jobs` | ✅ | [agent_jobs.sql:14](neuropost/supabase/agent_jobs.sql#L14) |
| `agent_outputs` | ✅ | [agent_jobs.sql:105](neuropost/supabase/agent_jobs.sql#L105) |
| `agent_feedback` | ✅ | [agent_feedback.sql:18-19](neuropost/supabase/agent_feedback.sql#L18) |
| `notifications_outbox` | ✅ | [20260418_notifications_outbox.sql:11](neuropost/supabase/migrations/20260418_notifications_outbox.sql#L11) |
| `content_categories` | ✅ | [content_categories.sql:14](neuropost/supabase/content_categories.sql#L14) |
| `post_analytics` | ✅ | [post_analytics.sql:17](neuropost/supabase/post_analytics.sql#L17) |
| `receta_usos` | ✅ | [phase7_creative_library.sql:128](neuropost/supabase/phase7_creative_library.sql#L128) |
| `recreation_requests` | ⚠️ **no verificado** — no hay `ON DELETE CASCADE` explícito en las migraciones revisadas | [recreation_replicate.sql](neuropost/supabase/recreation_replicate.sql), [20260418_recreation_hardening.sql](neuropost/supabase/migrations/20260418_recreation_hardening.sql) |
| `incidencias_soporte` | ❌ **Sin CASCADE** — `REFERENCES brands` sin ON DELETE | [incidencias_soporte.sql:9](neuropost/supabase/incidencias_soporte.sql#L9) |
| `provider_costs` | ❓ **no auditado** — depende de schema no revisado | — |

### 3.3 Lo que queda vivo tras el borrado

- **Storage de Supabase**: imágenes subidas por el cliente en `media_library` / `inspiration_references` — las **rows** se borran, pero los objetos en Supabase Storage **no se eliminan automáticamente por FK** (requiere lógica aplicativa). No encontrado código que borre los archivos binarios.
- **Outbox de Replicate**: si una recreación está en vuelo cuando el cliente borra su cuenta, el webhook llegará más tarde y fallará al buscar la row (manejado con 200 silencioso, OK).
- **Sentry events**: errores con PII ya enviados a Sentry persisten con la retención de Sentry (90 días en plan estándar). **No hay borrado propagado**.
- **Logs de Vercel / ingesta Claude**: si los prompts se quedaron en logs 30 días (Anthropic) o en logs de Vercel, siguen ahí.
- **Meta webhook events**: los comentarios que ya se procesaron quedan en `comments` (con cascade) pero si Meta los reenvía por su política de webhooks, se reinsertan tras el borrado — salvo que el cliente también desconecte Meta.

### 3.4 Flujo de borrado tras cancelación de suscripción (no-borrado)

Cancelar plan NO borra la cuenta — el acceso se mantiene hasta fin de ciclo facturado y luego la cuenta queda "inactiva". **No se encontró política explícita** de qué ocurre con los datos tras X tiempo inactivo. Riesgo RGPD: principio de minimización (art. 5.1.c) — datos conservados más de lo necesario.

---

## 4. Retención / TTL de inputs y outputs

**No existe cron de purga en el código.** Búsqueda exhaustiva de: `retention`, `cleanup`, `purge`, `cron/delete`, `DELETE FROM ... WHERE created_at <` → **cero resultados** en crons programados.

`agent_jobs.input` (JSONB) contiene el texto completo del usuario y **persiste indefinidamente**. Ejemplo real:

```json
// agent_jobs row processed by CommunityAgent
{
  "interactions": [
    { "authorName": "María García",
      "text": "Tengo una lesión lumbar, mi móvil es 666...",
      "timestamp": "2026-04-18T..." }
  ]
}
```

Lo mismo con `agent_outputs.payload` (respuestas del LLM que citan el input).

**Consecuencia:** cualquier cliente que pida ejercer su derecho de acceso (art. 15 RGPD) tiene derecho a que le devuelvas TODO lo que hay en `agent_jobs.input` donde aparezca su nombre/id. Sin un sistema de búsqueda por sujeto, responder a ese DSAR es operacionalmente difícil.

---

## 5. Análisis contra RGPD

### 5.1 Art. 6 — Base legal para el tratamiento

| Flujo | Base legal probable | Riesgo |
|---|---|---|
| Cliente NeuroPost → Copywriter/Planner/Analyst/… | **Ejecución de contrato** (art. 6.1.b) | ✅ OK |
| Cliente NeuroPost → SupportAgent | Ejecución de contrato | ✅ OK |
| Usuario final del cliente (seguidor IG) → CommunityAgent | **Interés legítimo** (art. 6.1.f) del cliente, con NeuroPost como encargado | ⚠️ **Requiere test de balance documentado** |
| Usuario final → texto compartido con Anthropic/USA | Interés legítimo + **transferencia internacional** (art. 44-49) | ⚠️ **Requiere SCCs o DPA con cláusulas art. 46** |
| Métricas Meta/IG → AnalystAgent | Interés legítimo | ⚠️ depende de qué se exporte — actualmente todo agregado, OK |

**Gap grave:** el usuario final del cliente (el seguidor de Instagram) no está informado de que NeuroPost procesa su comentario con una IA y lo envía a Anthropic/USA. No hay mecanismo de opt-out ni de aviso — **obligatorio bajo interés legítimo** salvo exención limitada.

### 5.2 Art. 28 — Encargado del tratamiento

NeuroPost actúa como **encargado** frente a su cliente (el negocio) y necesita:

1. **DPA firmado con cada cliente** — NeuroPost es encargado del cliente.
2. **DPAs firmados con todos los subencargados** (subprocesadores): Anthropic, Replicate, Runway, Higgsfield, NanoBanana, Supabase, Vercel, Stripe, Resend, Sentry, Meta.
3. **Lista pública de subencargados** en la página de privacidad. **No auditada** la presencia/completitud de esta lista.
4. **Mecanismo de objeción** por parte del cliente ante cambios de subencargado. **No encontrado en el código**.

### 5.3 Art. 32 — Seguridad del tratamiento

| Medida | Estado |
|---|---|
| Cifrado en tránsito (TLS) | ✅ Vercel lo hace nativo |
| Cifrado en reposo (Supabase Postgres) | ✅ Supabase lo hace nativo |
| HMAC en webhooks Replicate | ✅ Añadido en PR de hardening ([webhook-verify](neuropost/src/lib/replicate-webhook-verify.ts)) |
| HMAC en webhooks Meta | ❓ **no verificado en esta auditoría** |
| HMAC en webhooks Stripe | ✅ asumido (es estándar Stripe, pero revisar el handler) |
| Pseudonimización de PII en LLM | ❌ **No implementado** |
| Scrubbing de PII antes de Sentry | ❌ **No implementado** — [sentry.server.config.ts](neuropost/sentry.server.config.ts) no tiene `beforeSend` con filtrado |
| Control de acceso (RLS) | ✅ presente en todas las tablas auditadas |
| Rate limiting de agentes | ❌ no hay por agente; solo por plan semanal |
| Audit log de accesos | ⚠️ existe tabla `audit_log` pero schema no auditado |
| Backups | ✅ Supabase nativo |
| Incident response / plan de notificación brecha | ❓ **no documentado en el código** |

---

## 6. Hallazgos críticos priorizados

### 🔴 Bloqueantes para producción con clientes reales

1. **Inputs de CommunityAgent persisten indefinidamente en `agent_jobs.input`.** Violación potencial de principio de minimización (art. 5.1.c) y complica DSAR (art. 15).
2. **Sin DPA visible con Anthropic y sin ZDR activado.** Los mensajes de seguidores de clientes viajan a USA y se retienen 30 días por Anthropic. Esto es transferencia internacional sin base documental sólida.
3. **Sin aviso ni base legal clara para procesar DMs/comentarios de usuarios finales con IA.** Los seguidores no aceptaron nada; el cliente actúa como responsable del tratamiento pero NeuroPost debe facilitarle el texto legal.
4. **Sin PII scrubbing antes de Sentry.** Un error con `job.input` puede exponer nombre+teléfono+dirección de un tercero en un issue de Sentry.
5. **Storage de Supabase no se borra en la cascada.** Fotos subidas por el cliente pueden sobrevivir al borrado de cuenta.
6. **`recreation_requests` e `incidencias_soporte` sin `ON DELETE CASCADE` verificado.** Posibles "huérfanos" tras borrar marca.

### 🟠 Importantes pre-producción

7. **Sin política de retención activa** (ni cron de purga). RGPD exige un plazo definido para cada categoría de dato.
8. **Cancelación de suscripción no dispara borrado ni anonimización.** Datos viven indefinidamente.
9. **Lista de subencargados no auditada.** Obligatoria según art. 28.
10. **Sin mecanismo de DSAR** (acceso, rectificación, portabilidad, oposición). El cliente tiene 1 mes para responder y no hay herramienta visible.
11. **Sin filtro de caras / reconocimiento** en uploads propios del cliente. Arts. 9 (datos biométricos especiales) en riesgo si sube fotos de sus propios clientes finales.
12. **Anthropic retiene 30 días; Meta retiene; Replicate retiene.** Ninguna retención documentada hacia los clientes.

### 🟡 Deseables

13. **Sin región documentada** — se presume Vercel US / Supabase US. Idealmente para clientes EU debería migrarse a `eu-central` (Frankfurt) tanto en Supabase como en Vercel Functions.
14. **Sin scan NSFW** en outputs de Replicate/NanoBanana/Runway. TODO ya puesto en el webhook.
15. **Prompt injection sin sanitización** (ver auditoría de agentes).

---

## 7. Plan de acción compliance-ready

Priorizado por impacto RGPD vs esfuerzo.

### Fase 0 — Obligatorio antes del primer cliente productivo (1-2 semanas)

1. **Firmar DPA con Anthropic** y activar Zero Data Retention si procesa DMs/comentarios. Documentar nº de acuerdo en `docs/compliance-register.md`.
2. **Firmar DPAs con** Replicate, Runway, Higgsfield, NanoBanana, Supabase, Vercel, Stripe, Resend, Sentry, Meta. Publicar la lista en `/legal/subencargados`.
3. **Añadir filtro Sentry `beforeSend`** que elimine `job.input`, `job.payload`, `payload.message` y campos similares. Filtro probado contra rows reales.
4. **Implementar política de retención** con cron de purga:
   - `agent_jobs` con `status in (done, error, cancelled)` y `finished_at < NOW() - INTERVAL '90 days'` → DELETE.
   - Lo mismo con `agent_outputs`, `agent_feedback`, `comments`.
   - Configurable por variable de entorno `DATA_RETENTION_DAYS`.
5. **Cerrar cascadas faltantes**: añadir `ON DELETE CASCADE` en `recreation_requests.brand_id` e `incidencias_soporte.brand_id`.
6. **Borrar storage en el endpoint DELETE account** — iterar `media_library` e `inspiration_references` y llamar a `supabase.storage.remove()` antes de borrar filas.

### Fase 1 — Antes de abrir a clientes con audiencias grandes (2-4 semanas)

7. **DSAR tool interna**: endpoint admin `/api/admin/dsar?user_id=...` que exporte todo lo asociado a un usuario (art. 15) en JSON. Basta SQL parametrizado.
8. **Botón "Exportar mis datos"** en `/settings` → genera export asincrono, envía link firmado al email (art. 20 portabilidad).
9. **Anonimización tras cancelación** — pasados 30 días del final de ciclo, reemplazar `authorName`, `text` de interacciones, `client_notes`, etc. por hash+tipo. Mantiene analytics agregadas sin PII.
10. **Texto legal que el cliente debe añadir a su bio IG/FB**: "Este negocio usa asistencia IA para responder comentarios y DMs. Ver política de privacidad en ...". Generar snippet + link en el onboarding.
11. **Activar PII scrubbing en el pipeline de agentes críticos**: antes de enviar a Anthropic, pasar input por un regex simple que detecte y redacte teléfonos, emails, DNIs, tarjetas.

### Fase 2 — Madurez compliance (1-3 meses)

12. **Migrar infra a región EU**: Supabase project en Frankfurt/Dublin, Vercel Functions region EU. Reduce riesgo de transferencia internacional.
13. **Audit log completo** con quién accedió a qué PII — para auditorías externas e incidentes.
14. **Plan de respuesta a brechas** documentado (art. 33-34): 72h para notificar a AEPD + afectados.
15. **DPIA (Evaluación de impacto)** obligatoria por art. 35 al procesar datos a gran escala con IA — documentarla.
16. **Contract of processing (DPA)** con cada cliente, añadir a términos de servicio o como doc firmable en onboarding.
17. **Certificación ISO 27001 o SOC 2** si el target son clientes mid-market.

---

## 8. Matriz resumen para el equipo legal

| Control RGPD | Artículo | Estado | Responsable | Urgencia |
|---|---|---|---|---|
| Base legal documentada para todos los flujos | 6, 9 | ❌ | Legal + Eng | 🔴 |
| DPA cliente → NeuroPost | 28.3 | ❓ | Legal | 🔴 |
| DPA con subencargados | 28.4 | ❓ | Legal | 🔴 |
| Lista pública de subencargados | 28 + transparencia | ❓ | Legal + Producto | 🔴 |
| Aviso a usuarios finales tratados por CommunityAgent | 13-14 | ❌ | Cliente + NeuroPost (soporte) | 🔴 |
| Transferencia internacional (USA) con garantías | 44-49 | ❌ | Legal | 🔴 |
| Plazos de conservación definidos | 5.1.e | ❌ | Eng + Legal | 🟠 |
| Derecho de acceso DSAR | 15 | ❌ | Eng | 🟠 |
| Derecho de portabilidad | 20 | ❌ | Eng | 🟠 |
| Derecho de supresión | 17 | ⚠️ (parcial: cascadas OK, storage no, Sentry no) | Eng | 🟠 |
| Derecho de oposición | 21 | ❌ | Producto | 🟠 |
| Seguridad del tratamiento | 32 | ⚠️ parcial | Eng | 🟠 |
| DPIA para tratamiento con IA a gran escala | 35 | ❌ | Legal | 🟠 |
| Procedimiento notificación brecha 72h | 33-34 | ❓ | Legal + Eng | 🟠 |
| DPO designado (si aplica) | 37 | ❓ | Legal | depende del volumen |

---

## Apéndice A — Flujos de datos clave

```
Seguidor IG (tercero) ──→ Meta webhook ──→ NeuroPost API ──→ agent_jobs.input
                                                                    │
                                                                    ├──→ CommunityAgent (Anthropic/USA)
                                                                    ├──→ agent_outputs (Supabase)
                                                                    ├──→ Sentry en errores (USA)
                                                                    └──→ Anthropic logs 30d
```

```
Cliente NeuroPost ──→ /soporte ──→ support_tickets ──→ agent_jobs.input
                                                             │
                                                             ├──→ SupportAgent (Anthropic/USA)
                                                             ├──→ respuesta al cliente
                                                             └──→ persiste indefinidamente
```

```
Cliente NeuroPost ──→ /inspiracion/recrear ──→ recreation_requests
                                                     │
                                                     ├──→ Replicate Flux Dev (USA)
                                                     ├──→ webhook HMAC-verify
                                                     └──→ generated_images (Replicate CDN)
```

## Apéndice B — Archivos relevantes (referencia rápida)

- Políticas legales UI: [legal/privacidad](neuropost/src/app/legal/privacidad/page.tsx), [legal/terminos](neuropost/src/app/legal/terminos/page.tsx), [legal/cookies](neuropost/src/app/legal/cookies/page.tsx), [legal/aviso-legal](neuropost/src/app/legal/aviso-legal/page.tsx)
- Borrado de cuenta: [api/brands/account/route.ts](neuropost/src/app/api/brands/account/route.ts)
- Schema principal: [supabase/schema.sql](neuropost/supabase/schema.sql)
- Agentes que tocan PII: [backend/agents/community/prompts.ts](backend/agents/community/prompts.ts), [backend/agents/support/prompts.ts](backend/agents/support/prompts.ts)
- Webhook Meta: [api/meta/webhook/route.ts](neuropost/src/app/api/meta/webhook/route.ts)
- Webhook Replicate: [api/webhooks/replicate/route.ts](neuropost/src/app/api/webhooks/replicate/route.ts)
- Config Sentry: [sentry.server.config.ts](neuropost/sentry.server.config.ts), [sentry.client.config.ts](neuropost/sentry.client.config.ts)
