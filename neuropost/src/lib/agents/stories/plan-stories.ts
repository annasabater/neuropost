// =============================================================================
// stories:plan_stories
// =============================================================================
// Generates N story content_ideas for a weekly plan.
//
// Creative agent approach:
//   1. Reads the full brand kit (sector, tone, voice, services, description).
//   2. Calls Claude Haiku in batch to generate creative copy AND an image
//      prompt for each slot simultaneously.
//   3. Image sourcing priority:
//        a) inspiration_references (thumbnail_url)
//        b) media_library images
//        c) If none → stores Replicate image prompt in `hook` field
//           (prefixed "REPLICATE:") for the render endpoint to generate.
//   4. Schedule slots always keep verbatim copy from brand_material.
//
// Does NOT insert into DB — returns rows ready for caller to insert.
// Does NOT render images — that is the render/story/[idea_id] endpoint.

import Anthropic                       from '@anthropic-ai/sdk';
import type { Brand, StoryType }       from '@/types';
import type { BrandMaterialV2 }        from '@/types/brand-material';
import { pickActiveSchedule, isActiveNow } from '@/lib/brand-material/normalize';
import { log }                         from '@/lib/logger';
import {
  buildStoryCreativeBatchPrompt,
  FALLBACK_QUOTES,
  type StorySlotInput,
} from './prompts';

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

export function buildCopyFromSource(type: StoryType, source: BrandMaterialV2, now: Date = new Date()): string {
  switch (type) {
    case 'schedule': {
      // VERBATIM — este output entra LITERAL al copy de la story.
      // pickActiveSchedule preserva el comportamiento v1 cuando los materiales
      // upgradeados mantienen `schedules[0].days` idéntico al `days` original.
      const c = source.content as BrandMaterialV2<'schedule'>['content'];
      const chosen = pickActiveSchedule(c.schedules, now);
      const days = chosen?.days ?? [];
      // P19: filter corrupted entries where day or hours is not a string at runtime
      const validDays = days.filter(d => typeof d.day === 'string' && typeof d.hours === 'string');
      if (validDays.length < days.length) {
        log({ level: 'warn', scope: 'plan-stories', event: 'schedule_material_malformed',
              rejected: days.length - validDays.length });
      }
      return validDays.map(d => `${translateDay(d.day)}: ${d.hours}`).join('\n');
    }
    case 'promo': {
      const c = source.content as BrandMaterialV2<'promo'>['content'];
      const parts = [c.title, c.description].filter(Boolean) as string[];
      if (c.cta?.label) parts.push(c.cta.label);
      return parts.join('\n');
    }
    case 'data': {
      const c = source.content as BrandMaterialV2<'data'>['content'];
      const head = [c.name, c.description].filter(Boolean).join(': ');
      const variants = c.variants ?? [];
      if (variants.length >= 1 && variants.length <= 2) {
        const labels = variants.map(v => v.label).filter(Boolean);
        if (labels.length > 0) return `${head}\nOpciones: ${labels.join(', ')}`;
      }
      return head;
    }
    case 'quote': {
      const c = source.content as BrandMaterialV2<'quote'>['content'];
      const t = c.text ?? '';
      const a = c.author ?? '';
      return a ? `«${t}» — ${a}` : `«${t}»`;
    }
    case 'custom': {
      const c = source.content as BrandMaterialV2<'free'>['content'];
      return String(c.content ?? '');
    }
    default:
      return '';
  }
}

// ─── Creative content generation ─────────────────────────────────────────────

interface StoryCreativeResult {
  copy:        string;
  imagePrompt: string;
  isFallback:  boolean;
}

async function generateStoryCreativeContent(
  brand: Brand,
  slots: StorySlot[],
): Promise<StoryCreativeResult[]> {
  const slotInputs: StorySlotInput[] = slots.map((slot, i) => ({
    index:        i,
    type:         slot.type,
    existingCopy: slot.source !== null ? buildCopyFromSource(slot.type, slot.source) : null,
  }));

  try {
    const prompt  = buildStoryCreativeBatchPrompt(brand, slotInputs);
    const message = await aiClient.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block');

    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as unknown[];
    if (!Array.isArray(parsed) || parsed.length < slots.length) throw new Error('Bad response length');

    return parsed.slice(0, slots.length).map((item, i) => {
      const obj   = item as AnyRecord;
      const input = slotInputs[i]!;

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
    });
  } catch (err) {
    console.warn('[plan-stories] Creative content generation failed, using fallback:', err instanceof Error ? err.message : err);
    // Graceful fallback: verbatim material copy or generic quotes, no image prompts
    return slots.map((slot, i) => ({
      copy: slot.source !== null
        ? (buildCopyFromSource(slot.type, slot.source) || FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!)
        : FALLBACK_QUOTES[i % FALLBACK_QUOTES.length]!,
      imagePrompt: '',
      isFallback:  true,
    }));
  }
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface InspirationRef {
  id:            string;
  thumbnail_url: string | null;
}

export interface MediaRef {
  url: string;
}

export interface PlanStoriesParams {
  brand_id:                  string;
  week_id:                   string;
  brand:                     Brand;
  brand_material:            BrandMaterialV2[];
  stories_per_week:          number;
  stories_templates_enabled: string[];
  startPosition:             number;
  inspiration_refs?:         InspirationRef[];
  media_refs?:               MediaRef[];
}

export interface StoryIdeaRow {
  week_id:                 string;
  brand_id:                string;
  position:                number;
  format:                  'story';
  angle:                   string;
  hook:                    null;
  image_generation_prompt: string | null;
  copy_draft:              string | null;
  hashtags:                null;
  suggested_asset_url:     string | null;
  suggested_asset_id:      null;
  category_id:             null;
  agent_output_id:         null;
  status:                  'pending';
  content_kind:            'story';
  story_type:              StoryType;
  template_id:             string | null;
  rendered_image_url:      null;
  generation_fallback:     boolean;
}

// ─── Slot planning ─────────────────────────────────────────────────────────────

export interface StorySlot {
  type:   StoryType;
  source: BrandMaterialV2 | null;
}

export function buildSlots(brand_material: BrandMaterialV2[], stories_per_week: number): StorySlot[] {
  const slots: StorySlot[] = [];
  const now = new Date();

  // 1. schedule — at most one
  const schedule = brand_material.find(m => m.category === 'schedule' && m.active);
  if (schedule && slots.length < stories_per_week) {
    slots.push({ type: 'schedule', source: schedule });
  }

  // 2. promo — active, not expired, max 3 (usa isActiveNow — preserva semántica)
  const promos = brand_material
    .filter(m => m.category === 'promo' && m.active)
    .filter(m => isActiveNow(m, now))
    .slice(0, 3);
  for (const p of promos) {
    if (slots.length >= stories_per_week) break;
    slots.push({ type: 'promo', source: p });
  }

  // 3. remaining slots — round-robin across data / quote / custom pools
  type TypePool = { type: StoryType; pool: BrandMaterialV2[] };
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
      slots.push({ type: 'quote', source: null });
    } else {
      const tq   = typeQueue[qi % typeQueue.length]!;
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

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function planStoriesHandler(params: PlanStoriesParams): Promise<StoryIdeaRow[]> {
  const {
    brand_id, week_id, brand, brand_material,
    stories_per_week, stories_templates_enabled, startPosition,
  } = params;

  if (stories_per_week <= 0) return [];

  const slots = buildSlots(brand_material, stories_per_week);

  // Generate creative copy + image prompts for all slots in one batch call
  const creativeResults = await generateStoryCreativeContent(brand, slots);

  // Build image pool: inspiration first (more curated), then media library
  const allImages = shuffled([
    ...(params.inspiration_refs ?? [])
      .filter((r): r is InspirationRef & { thumbnail_url: string } => !!r.thumbnail_url)
      .map(r => r.thumbnail_url),
    ...(params.media_refs ?? []).map(r => r.url),
  ]);

  const K = stories_templates_enabled.length;

  return slots.map((slot, idx): StoryIdeaRow => {
    const creative  = creativeResults[idx]!;
    // Assign images cycling through pool so each story gets a different background
    const imageUrl  = allImages.length > 0 ? (allImages[idx % allImages.length] ?? null) : null;
    // P17: store image prompt in dedicated column; hook is no longer used for REPLICATE: encoding
    const imageGenPrompt = !imageUrl && creative.imagePrompt ? creative.imagePrompt : null;

    return {
      week_id,
      brand_id,
      position:                startPosition + idx,
      format:                  'story',
      angle:                   slot.type,
      hook:                    null,
      image_generation_prompt: imageGenPrompt,
      copy_draft:              creative.copy || null,
      hashtags:                null,
      suggested_asset_url:     imageUrl,
      suggested_asset_id:      null,
      category_id:             null,
      agent_output_id:         null,
      status:                  'pending',
      content_kind:            'story',
      story_type:              slot.type,
      template_id:             K > 0 ? stories_templates_enabled[idx % K] ?? null : null,
      rendered_image_url:      null,
      generation_fallback:     creative.isFallback,
    };
  });
}
