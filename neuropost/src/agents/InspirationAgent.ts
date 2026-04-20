// =============================================================================
// NEUROPOST — InspirationAgent
// Analyzes reference images and generates recreation instructions.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StyleAnalysis {
  composition:  string;
  lighting:     string;
  colorPalette: string[];
  mood:         string;
  keyElements:  string[];
}

export interface InspirationAnalysisResult {
  styleAnalysis:      StyleAnalysis;
  recreationPrompt:   string;
  workerInstructions: string;
  suggestedCaption:   string;
  suggestedHashtags:  string[];
}

export interface AnalyzeReferenceInput {
  referenceImageUrl: string;
  clientNotes:       string;
  brandContext:      string; // brand name + sector + style
  sector:            string;
  visualStyle?:      string;
}

// ─── Analyze reference image ──────────────────────────────────────────────────

export async function analyzeReference(input: AnalyzeReferenceInput): Promise<InspirationAnalysisResult> {
  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `Eres el director creativo de NeuroPost.
Analiza esta imagen de referencia que un cliente quiere usar como inspiración para su contenido.

Extrae:
1. Composición: cómo están organizados los elementos
2. Iluminación: tipo de luz, dirección, temperatura
3. Paleta de colores: colores dominantes y de acento
4. Estilo fotográfico: editorial, lifestyle, producto...
5. Formato: cuadrado, vertical, horizontal
6. Mood: energético, tranquilo, lujoso, cercano...
7. Elementos clave: fondo, props, textura...

Luego genera:
- Un prompt de fotografía para recrear el ESTILO (no el contenido) con el producto/negocio del cliente
- Instrucciones para el trabajador sobre cómo hacer la foto o editar la imagen del cliente
- Caption sugerido adaptado al negocio del cliente
- Hashtags sugeridos

El resultado debe ser 100% original y del negocio del cliente. No copiar texto, logos ni elementos identificativos del contenido original.

Responde SOLO en JSON válido:
{
  "styleAnalysis": {
    "composition": "...",
    "lighting": "...",
    "colorPalette": ["#xxx", "#yyy"],
    "mood": "...",
    "keyElements": ["...", "..."]
  },
  "recreationPrompt": "...",
  "workerInstructions": "...",
  "suggestedCaption": "...",
  "suggestedHashtags": ["#tag1", "#tag2"]
}`,
    messages: [{
      role:    'user',
      content: [
        {
          type:   'image',
          source: {
            type: 'url',
            url:  input.referenceImageUrl,
          },
        },
        {
          type: 'text',
          text: `Negocio: ${input.brandContext}\nSector: ${input.sector}\nNotas del cliente: ${input.clientNotes}\nEstilo deseado: ${input.visualStyle ?? 'Sin preferencia'}`,
        },
      ],
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in inspiration response');
  return JSON.parse(jsonMatch[0]) as InspirationAnalysisResult;
}
