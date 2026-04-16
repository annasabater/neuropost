// =============================================================================
// Onboarding content trigger — generates first content after connection/upload
// =============================================================================
// Called when:
//   1. User connects Instagram (meta/callback)
//   2. User uploads first media to library
//
// Only fires ONCE per brand (checks onboarding_content_triggered flag).
// Pipeline: build_taxonomy → generate 3 ideas → generate 1 demo image

import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Trigger first-content generation for a brand. Idempotent — skips if already triggered.
 * @param brandId The brand to generate content for
 * @param trigger What caused this: 'instagram_connect' | 'media_upload'
 */
export async function triggerOnboardingContent(
  brandId: string,
  trigger: 'instagram_connect' | 'media_upload',
): Promise<boolean> {
  const db = createAdminClient() as DB;

  // Check if already triggered (idempotent)
  const { data: brand } = await db
    .from('brands')
    .select('id, name, sector, visual_style, onboarding_content_triggered')
    .eq('id', brandId)
    .single();

  if (!brand) return false;
  if (brand.onboarding_content_triggered) return false;

  // Mark as triggered immediately (prevent double-fire)
  await db.from('brands').update({
    onboarding_content_triggered: true,
    first_content_at: new Date().toISOString(),
  }).eq('id', brandId);

  const now = Date.now();

  // Step 1: Build taxonomy (immediate, if not already done)
  const { data: existingTaxonomy } = await db
    .from('content_categories')
    .select('id')
    .eq('brand_id', brandId)
    .limit(1);

  if (!existingTaxonomy?.length) {
    await queueJob({
      brand_id:     brandId,
      agent_type:   'strategy',
      action:       'build_taxonomy',
      input:        { _trigger: trigger },
      priority:     90,
      requested_by: 'system',
    });
  }

  // Step 2: Generate 3 content ideas (after 2 min, so taxonomy is ready)
  await queueJob({
    brand_id:      brandId,
    agent_type:    'strategy',
    action:        'generate_ideas',
    input:         { count: 3, _trigger: trigger },
    priority:      85,
    requested_by:  'system',
    scheduled_for: new Date(now + 2 * 60_000).toISOString(),
  });

  // Step 3: Generate 1 demo image (after 4 min, so ideas exist)
  await queueJob({
    brand_id:      brandId,
    agent_type:    'content',
    action:        'generate_image',
    input: {
      userPrompt:   `Contenido profesional para Instagram de ${brand.name}, sector ${brand.sector ?? 'negocio local'}. Estilo ${brand.visual_style ?? 'moderno'}, alta calidad.`,
      sector:       brand.sector       ?? 'otro',
      visualStyle:  brand.visual_style ?? 'warm',
      brandContext:  `${brand.name} — ${brand.sector ?? 'negocio local'}`,
      brandId,
      format:       'post',
      _demo:        true,
      _trigger:     trigger,
    },
    priority:      80,
    requested_by:  'system',
    scheduled_for: new Date(now + 4 * 60_000).toISOString(),
  });

  // Notify the user that content generation has started
  await notify(brandId, 'plan_activated',
    'Estamos preparando tu primer contenido. En unos minutos tendrás ideas y una imagen de demo.',
    { trigger },
  ).catch(() => null);

  console.log(`[onboarding-content] Triggered for brand ${brandId} via ${trigger}`);
  return true;
}
