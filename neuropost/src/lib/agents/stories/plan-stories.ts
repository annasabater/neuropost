// =============================================================================
// stories:plan_stories
// =============================================================================
// Generates N story content_ideas for a weekly plan using brand_material.
//
// Slot distribution algorithm:
//   1. One 'schedule' slot if brand has an active schedule entry.
//   2. Up to 3 'promo' slots for active non-expired promos.
//   3. Remaining slots filled via round-robin across data/quote/custom pools.
//   4. Slots with no matching material get AI-generated quotes (batched).
//
// Does NOT insert into DB — returns rows ready for caller to insert.
// Does NOT render images — that is Sprint 12.

import Anthropic                     from '@anthropic-ai/sdk';
import type { Brand, BrandMaterial, StoryType } from '@/types';
import { buildQuotesPrompt, FALLBACK_QUOTES } from './prompts';

const aiClient = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const DAY_ES: Record<string, string> = {
  monday:    'Lunes',
  tuesday:   'Martes',
  wednesday: 'Miércoles',
  thursday:  'Jueves',
  friday:    'Viernes',
  saturday:  'Sábado',
  sunday:    'Domingo',
};

function translateDay(day: string): string {
  return DAY_ES[day.toLowerCase()] ?? day;
}

function buildCopyFromSource(type: StoryType, source: BrandMaterial): string {
  const c = source.content as AnyRecord;
  switch (type) {
    case 'schedule': {
      const days = (c.days as Array<{ day: string; hours: string }>) ?? [];
      return days.map(d => `${translateDay(d.day)}: ${d.hours}`).join('\n');
    }
    case 'promo':
      return [c.title, c.description].filter(Boolean).join('\n');
    case 'data':
      return [c.label, c.description].filter(Boolean).join('\n');
    case 'quote':
      return String(c.text ?? '');
    case 'custom':
      return String(c.text ?? '');
    default:
      return '';
  }
}

async function generateAIQuotes(brand: Brand, count: number): Promise<string[]> {
  try {
    const prompt  = buildQuotesPrompt(brand, count);
    const message = await aiClient.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block');

    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');

    return parsed.slice(0, count).map(String);
  } catch (err) {
    console.warn('[plan-stories] AI quote generation failed, using fallback:', err instanceof Error ? err.message : err);
    return Array.from({ length: count }, (_, i) => FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]);
  }
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface PlanStoriesParams {
  brand_id:                  string;
  week_id:                   string;
  brand:                     Brand;
  brand_material:            BrandMaterial[];
  stories_per_week:          number;
  stories_templates_enabled: string[];
}

export interface StoryIdeaRow {
  week_id:             string;
  brand_id:            string;
  position:            number;
  format:              'story';
  angle:               string;
  hook:                null;
  copy_draft:          string | null;
  hashtags:            null;
  suggested_asset_url: null;
  suggested_asset_id:  null;
  category_id:         null;
  agent_output_id:     null;
  status:              'pending';
  content_kind:        'story';
  story_type:          StoryType;
  template_id:         string | null;
  rendered_image_url:  null;
}

// ─── Slot planning ─────────────────────────────────────────────────────────────

interface StorySlot {
  type:   StoryType;
  source: BrandMaterial | null;
}

function buildSlots(
  brand_material: BrandMaterial[],
  stories_per_week: number,
): StorySlot[] {
  const slots: StorySlot[] = [];
  const now = new Date();

  // 1. schedule — at most one
  const schedule = brand_material.find(m => m.category === 'schedule' && m.active);
  if (schedule && slots.length < stories_per_week) {
    slots.push({ type: 'schedule', source: schedule });
  }

  // 2. promo — active, not expired, max 3
  const promos = brand_material
    .filter(m => m.category === 'promo' && m.active)
    .filter(m => !m.valid_until || new Date(m.valid_until) > now)
    .slice(0, 3);
  for (const p of promos) {
    if (slots.length >= stories_per_week) break;
    slots.push({ type: 'promo', source: p });
  }

  // 3. remaining slots — round-robin across data / quote / custom pools
  type TypePool = { type: StoryType; pool: BrandMaterial[] };
  const typeQueue: TypePool[] = (
    [
      { type: 'quote'  as StoryType, pool: [...brand_material.filter(m => m.category === 'quote'  && m.active)] },
      { type: 'data'   as StoryType, pool: [...brand_material.filter(m => m.category === 'data'   && m.active)] },
      { type: 'custom' as StoryType, pool: [...brand_material.filter(m => m.category === 'free'   && m.active)] },
    ] as TypePool[]
  ).filter(tq => tq.pool.length > 0);

  let qi = 0;
  while (slots.length < stories_per_week) {
    if (typeQueue.length === 0) {
      // No material left — AI quote placeholder
      slots.push({ type: 'quote', source: null });
    } else {
      const tq = typeQueue[qi % typeQueue.length];
      const item = tq.pool.shift()!;
      slots.push({ type: tq.type, source: item });
      if (tq.pool.length === 0) {
        typeQueue.splice(qi % typeQueue.length, 1);
      } else {
        qi++;
      }
    }
  }

  return slots;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function planStoriesHandler(params: PlanStoriesParams): Promise<StoryIdeaRow[]> {
  const { brand_id, week_id, brand, brand_material, stories_per_week, stories_templates_enabled } = params;

  if (stories_per_week <= 0) return [];

  const slots = buildSlots(brand_material, stories_per_week);

  // Batch AI quotes for all null-source quote slots
  const aiSlotIndices = slots
    .map((s, i) => (s.type === 'quote' && s.source === null ? i : -1))
    .filter(i => i !== -1);

  let aiQuotes: string[] = [];
  if (aiSlotIndices.length > 0) {
    aiQuotes = await generateAIQuotes(brand, aiSlotIndices.length);
  }

  const K = stories_templates_enabled.length;
  let aiQuoteIdx = 0;

  return slots.map((slot, idx): StoryIdeaRow => {
    let copyDraft: string | null;

    if (slot.source !== null) {
      copyDraft = buildCopyFromSource(slot.type, slot.source) || null;
    } else {
      // AI-generated quote (type must be 'quote' here per buildSlots logic)
      copyDraft = aiQuotes[aiQuoteIdx++] ?? FALLBACK_QUOTES[idx % FALLBACK_QUOTES.length];
    }

    return {
      week_id,
      brand_id,
      position:            idx,
      format:              'story',
      angle:               slot.type,             // NOT NULL — story_type is descriptive enough
      hook:                null,
      copy_draft:          copyDraft,
      hashtags:            null,
      suggested_asset_url: null,
      suggested_asset_id:  null,
      category_id:         null,
      agent_output_id:     null,
      status:              'pending',
      content_kind:        'story',
      story_type:          slot.type,
      template_id:         K > 0 ? stories_templates_enabled[idx % K] : null,
      rendered_image_url:  null,
    };
  });
}
