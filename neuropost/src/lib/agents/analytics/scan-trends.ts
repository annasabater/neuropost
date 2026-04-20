// =============================================================================
// analytics:scan_trends
// =============================================================================
// Detects Instagram trends using Claude and persists them into the `trends`
// table. Supports two modes:
//   • sector_key = null → global trends (platform-wide)
//   • sector_key = 'gym' | 'restaurante' | ... → sector-specific
//
// Called by /api/cron/global-trends once per week for global + each active
// sector. The results are consumed by strategy agents for every brand in
// that sector — this is the "shared intelligence" layer.
//
// Input: { sector_key?: string | null }

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob, HandlerResult } from '../types';

const client = new Anthropic();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function currentWeek(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const diff = (d.getTime() - start.getTime()) / 86_400_000;
  const w = Math.ceil((diff + start.getUTCDay() + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

const SYSTEM = `Eres un analista de tendencias de Instagram. Devuelve SOLO JSON válido.

Estructura exacta:
{
  "trends": [
    {
      "title": "nombre corto",
      "description": "1-2 frases de qué es y por qué funciona",
      "format": "reel" | "carrusel" | "foto" | "story",
      "engagement_potential": "alto" | "medio" | "bajo",
      "hashtags": ["#ejemplo"],
      "audio_hint": "nombre de audio o null"
    }
  ],
  "summary": "párrafo de 3 frases máximo con el panorama general"
}

Reglas:
- 5 a 10 tendencias, ordenadas por potencial de engagement
- Basadas en lo que REALMENTE funciona esta semana en Instagram España
- Si el sector es específico, adapta las tendencias a ese negocio
- NO inventes — si no estás seguro, sesga hacia tendencias conocidas`;

export async function scanTrendsHandler(job: AgentJob): Promise<HandlerResult> {
  const sectorKey = (job.input as { sector_key?: string | null }).sector_key ?? null;
  const week = currentWeek();

  try {
    const db = createAdminClient() as DB;

    // Skip if already scanned this week for this sector.
    const { data: existing } = await db
      .from('trends')
      .select('id')
      .eq('week', week)
      .is('sector_key', sectorKey === null ? null : undefined);
    // Supabase .is() only works for null; for non-null use .eq()
    let alreadyExists = false;
    if (sectorKey === null) {
      const { data: e } = await db.from('trends').select('id').eq('week', week).is('sector_key', null).maybeSingle();
      alreadyExists = !!e;
    } else {
      const { data: e } = await db.from('trends').select('id').eq('week', week).eq('sector_key', sectorKey).maybeSingle();
      alreadyExists = !!e;
    }

    if (alreadyExists) {
      return {
        type: 'ok',
        outputs: [{
          kind: 'analysis',
          payload: { week, sector_key: sectorKey, skipped: true, reason: 'already_scanned' } as unknown as Record<string, unknown>,
          model: 'cache',
        }],
      };
    }

    const sectorLabel = sectorKey
      ? `para negocios del sector "${sectorKey}" en España`
      : 'para Instagram en España (todas las industrias)';

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      system:     SYSTEM,
      messages: [{ role: 'user', content: `Analiza las tendencias de Instagram de esta semana (${week}) ${sectorLabel}. Devuelve el JSON.` }],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('LLM returned no text');
    const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { trends: unknown[]; summary?: string };

    if (!Array.isArray(parsed.trends)) throw new Error('Missing trends array');

    // Persist.
    const { error: upsertErr } = await db.from('trends').upsert({
      sector_key:   sectorKey,
      week,
      trends:       parsed.trends,
      summary:      parsed.summary ?? null,
      source_model: 'claude-haiku-4-5-20251001',
    }, { onConflict: 'sector_key,week' });
    if (upsertErr) throw new Error(`upsert trends: ${upsertErr.message}`);

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: { week, sector_key: sectorKey, trends_count: parsed.trends.length, summary: parsed.summary } as unknown as Record<string, unknown>,
        model:   'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
}
