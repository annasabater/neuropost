// ─────────────────────────────────────────────────────────────────────────────
// Postly — IdeasAgent prompts
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types.js';
import type { IdeasInput } from './types.js';

export function buildIdeasSystemPrompt(ctx: AgentContext): string {
  const voice = ctx.brandVoice;
  return `Eres el agente generador de ideas de contenido de Postly.

Negocio: ${ctx.businessName}
Sector: ${voice.sector}
Tono: ${voice.tone}
Idioma: ${voice.language}
Palabras clave: ${voice.keywords.join(', ')}
Palabras prohibidas: ${voice.forbiddenWords.join(', ')}${ctx.brandVoiceDoc ? `\nVoz de marca: ${ctx.brandVoiceDoc.substring(0, 400)}` : ''}

Genera ideas creativas, específicas para el sector y accionables.
Cada idea debe tener caption completo listo para publicar.
Responde ÚNICAMENTE con JSON válido.`;
}

export function buildIdeasUserPrompt(input: IdeasInput): string {
  return `Petición del usuario: "${input.prompt}"
Número de ideas: ${input.count}

Devuelve este JSON exacto:
{
  "ideas": [
    {
      "title":     "string (título breve de la idea)",
      "format":    "image | reel | carousel | story",
      "caption":   "string (caption completo listo para publicar)",
      "hashtags":  ["string"],
      "bestTime":  "string (ej: Jueves 18:00)",
      "rationale": "string (por qué esta idea funcionará)",
      "goal":      "engagement | awareness | promotion | community"
    }
  ]
}`;
}
