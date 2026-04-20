// =============================================================================
// NEUROPOST — ChurnAgent
// Monitors customer behavior, detects churn risk, and triggers retention.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChurnRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnMetrics {
  daysSinceLogin:       number;
  daysSincePublished:   number;
  planUsagePct:         number;   // 0-1
  rejectedInARow:       number;
  engagementDropPct:    number;   // 0-100, positive = drop
}

export interface ChurnScoreResult {
  score:       number;   // 0-100
  risk:        ChurnRisk;
  reasons:     string[];
}

// ─── Score calculator ─────────────────────────────────────────────────────────

export function calculateChurnScore(m: ChurnMetrics): ChurnScoreResult {
  let score   = 0;
  const reasons: string[] = [];

  // Activity
  if (m.daysSinceLogin > 7)  { score += 30; reasons.push(`Sin login ${m.daysSinceLogin} días`); }
  else if (m.daysSinceLogin > 4) { score += 15; reasons.push(`Sin login ${m.daysSinceLogin} días`); }
  else if (m.daysSinceLogin > 2) { score += 5; }

  // Publishing
  if (m.daysSincePublished > 7)  { score += 25; reasons.push(`Sin publicar ${m.daysSincePublished} días`); }
  else if (m.daysSincePublished > 4) { score += 10; reasons.push(`Sin publicar ${m.daysSincePublished} días`); }

  // Plan usage
  if (m.planUsagePct < 0.2)  { score += 20; reasons.push(`Uso del plan muy bajo (${Math.round(m.planUsagePct * 100)}%)`); }
  else if (m.planUsagePct < 0.5) { score += 10; reasons.push(`Uso del plan bajo (${Math.round(m.planUsagePct * 100)}%)`); }

  // Rejected posts
  if (m.rejectedInARow > 5) { score += 15; reasons.push(`${m.rejectedInARow} posts rechazados seguidos`); }
  else if (m.rejectedInARow > 3) { score += 8; }

  // Engagement drop
  if (m.engagementDropPct > 50) { score += 10; reasons.push(`Engagement cayó ${m.engagementDropPct}%`); }

  score = Math.min(score, 100);

  let risk: ChurnRisk;
  if (score >= 70)      risk = 'critical';
  else if (score >= 50) risk = 'high';
  else if (score >= 30) risk = 'medium';
  else                  risk = 'low';

  return { score, risk, reasons };
}

// ─── Retention email generator ────────────────────────────────────────────────

export async function generateRetentionEmail(input: {
  brandName:     string;
  sector:        string;
  diasInactivo:  number;
  lastActivity:  string;
  churnRisk:     ChurnRisk;
  reasons:       string[];
}): Promise<{ subject: string; body: string }> {
  const tone = input.churnRisk === 'critical' ? 'urgente y personal' : 'amigable y motivador';

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `Eres el equipo de éxito de clientes de NeuroPost, un SaaS de gestión de redes sociales con IA.
Escribe un email de retención ${tone} para un cliente que está dejando de usar la plataforma.
El email debe ser muy personalizado mencionando su negocio específicamente.
Recuérdales el valor que están perdiendo y qué tienen pendiente en la plataforma.
NO suenes desesperado ni vendedor.

Devuelve SOLO JSON:
{
  "subject": "asunto del email",
  "body": "cuerpo del email en HTML (párrafos con <p>, negritas con <strong>)"
}`,
    messages: [{
      role: 'user',
      content: `Cliente: ${input.brandName} (${input.sector})
Días inactivo: ${input.diasInactivo}
Última actividad: ${input.lastActivity}
Motivos de riesgo: ${input.reasons.join(', ')}
Nivel de riesgo: ${input.churnRisk}

Redacta el email de retención.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in retention email response');
  return JSON.parse(jsonMatch[0]) as { subject: string; body: string };
}
