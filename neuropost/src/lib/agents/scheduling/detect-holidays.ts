// =============================================================================
// scheduling:detect_holidays
// =============================================================================
// Uses Claude to detect public holidays, cultural dates, and relevant
// commercial events for ANY country + region + city for a given year.
// Works worldwide — the LLM determines the correct festive calendar based
// on the brand's location fields.
//
// Input:
//   { brand_id, country, region?, city?, year?, force_refresh? }
//
// Output:
//   Saves events to `calendar_events` table and updates
//   brands.calendar_events_generated_at.

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJob, HandlerResult } from '../types';

const anthropic = new Anthropic();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const SYSTEM = `Eres un experto en calendarios festivos y culturales de todo el mundo.
Tu tarea es generar una lista exhaustiva de fechas relevantes para un negocio en una ubicación específica.

Incluye:
1. Festivos nacionales del país
2. Festivos regionales/autonómicos de la región indicada
3. Fiestas locales del municipio o ciudad (si se especifica)
4. Fechas comerciales importantes (San Valentín, Black Friday, Navidad, etc.)
5. Días de concienciación relevantes (Día de la Mujer, Día del Medioambiente, etc.)

Para cada fecha devuelve:
- title: nombre corto del evento (máx. 40 caracteres)
- date: formato YYYY-MM-DD
- type: "holiday" | "cultural" | "commercial" | "local" | "awareness"
- relevance: "high" | "medium" | "low" (para un negocio genérico)
- description: 1 frase explicativa
- suggested_content_idea: idea concreta de post para esa fecha (1 frase)

RESPONDE SOLO con JSON válido, sin markdown, sin bloques de código.
Estructura exacta:
{
  "events": [
    {
      "title": "...",
      "date": "YYYY-MM-DD",
      "type": "holiday",
      "relevance": "high",
      "description": "...",
      "suggested_content_idea": "..."
    }
  ]
}

Reglas:
- Ordena por fecha ascendente
- Entre 30 y 80 eventos por año
- Si no conoces las fiestas locales exactas del municipio, incluye las regionales y ponlas como "local"
- NO inventes fechas que no existan
- Para países fuera de España: usa el calendario local correcto`;

interface HolidayEvent {
  title: string;
  date: string;
  type: string;
  relevance: string;
  description: string;
  suggested_content_idea: string;
}

export async function detectHolidaysHandler(job: AgentJob): Promise<HandlerResult> {
  const input = job.input as {
    brand_id?: string;
    country?: string;
    region?: string;
    city?: string;
    year?: number;
    force_refresh?: boolean;
  };

  const db = createAdminClient() as DB;
  const brandId = job.brand_id ?? input.brand_id;
  const year = input.year ?? new Date().getFullYear();

  if (!brandId) {
    return { type: 'fail', error: 'brand_id is required' };
  }

  // Load brand data if location not provided directly
  let country = input.country;
  let region  = input.region;
  let city    = input.city;

  if (!country) {
    const { data: brand } = await db
      .from('brands')
      .select('location, city')
      .eq('id', brandId)
      .single();

    if (brand?.location) {
      // location is stored as "Region, Country" or just "Country"
      const parts = (brand.location as string).split(',').map((s: string) => s.trim());
      if (parts.length >= 2) {
        country = parts[parts.length - 1];
        region  = parts.slice(0, parts.length - 1).join(', ');
      } else {
        country = parts[0];
      }
    }
    city = city ?? brand?.city ?? undefined;
  }

  if (!country) {
    // No location at all — skip gracefully
    return {
      type: 'ok',
      outputs: [{ kind: 'analysis', payload: { skipped: true, reason: 'no_location' } }],
    };
  }

  // Check if already generated recently (unless force_refresh)
  if (!input.force_refresh) {
    const { data: existing } = await db
      .from('calendar_events')
      .select('id')
      .eq('brand_id', brandId)
      .eq('year', year)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        type: 'ok',
        outputs: [{ kind: 'analysis', payload: { skipped: true, reason: 'already_exists', year } }],
      };
    }
  }

  // Build location string for the prompt
  const locationParts = [city, region, country].filter(Boolean);
  const locationStr   = locationParts.join(', ');

  const userMessage = `Genera el calendario festivo completo para el año ${year} en: ${locationStr}.
Si la ubicación es española, incluye festivos nacionales + autonómicos + locales del municipio si aplica.
Si es otro país, usa el calendario oficial de ese país y sus subdivisiones.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown code fences if model wraps the JSON
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: { events: HolidayEvent[] };
    try {
      parsed = JSON.parse(clean) as { events: HolidayEvent[] };
    } catch {
      return { type: 'retry', error: `Invalid JSON from LLM: ${raw.slice(0, 200)}` };
    }

    if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
      return { type: 'fail', error: 'LLM returned empty events array' };
    }

    // Upsert events into calendar_events table
    const rows = parsed.events.map((e) => ({
      brand_id:               brandId,
      title:                  e.title?.slice(0, 120) ?? 'Evento',
      date:                   e.date,
      type:                   e.type ?? 'holiday',
      relevance:              e.relevance ?? 'medium',
      description:            e.description ?? null,
      suggested_content_idea: e.suggested_content_idea ?? null,
      country,
      region:                 region ?? null,
      city:                   city ?? null,
      year,
      source:                 'agent',
    }));

    // Insert in batches of 50, ignore conflicts (same brand+date+title)
    for (let i = 0; i < rows.length; i += 50) {
      await db
        .from('calendar_events')
        .upsert(rows.slice(i, i + 50), { onConflict: 'brand_id,date,title', ignoreDuplicates: true });
    }

    // Update brand's last generation timestamp
    await db
      .from('brands')
      .update({ calendar_events_generated_at: new Date().toISOString() })
      .eq('id', brandId);

    return {
      type: 'ok',
      outputs: [{
        kind: 'analysis',
        payload: {
          events_created: rows.length,
          year,
          location: locationStr,
          tokens_used: message.usage.input_tokens + message.usage.output_tokens,
        },
      }],
    };
  } catch (err) {
    return { type: 'retry', error: err instanceof Error ? err.message : String(err) };
  }
}
