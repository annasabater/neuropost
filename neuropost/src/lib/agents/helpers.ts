// =============================================================================
// Agent handler helpers
// =============================================================================
// Every handler needs the same two things: load the brand row and build the
// AgentContext. Extracting it here keeps each handler to ~10 lines of real
// work instead of repeating the same 8-line dance.

import { createAdminClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import type { Brand } from '@/types';
import type { AgentContext } from '@neuropost/agents';
import type { AgentJob, HandlerResult } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Load a brand row by id using the admin client.
 * Returns null if the brand does not exist.
 */
export async function loadBrand(brandId: string): Promise<Brand | null> {
  const db = createAdminClient() as DB;
  const { data } = await db.from('brands').select('*').eq('id', brandId).single();
  return (data as Brand | null) ?? null;
}

/**
 * Load brand + brief tables + build AgentContext in one call.
 * Throws a descriptive error if the brand is missing — callers should catch
 * and return a `fail` HandlerResult.
 */
export async function loadBrandContext(brandId: string): Promise<{
  brand: Brand;
  ctx:   AgentContext;
}> {
  const db = createAdminClient() as DB;

  const [
    { data: brand },
    { data: faqs },
    { data: products },
    { data: personas },
    { data: competitors },
  ] = await Promise.all([
    db.from('brands').select('*').eq('id', brandId).single(),
    db.from('brand_faqs').select('category, question, answer').eq('brand_id', brandId).eq('is_approved', true).order('display_order'),
    db.from('brand_products').select('name, price_cents, currency, main_benefit, is_hero').eq('brand_id', brandId).order('display_order'),
    db.from('brand_personas').select('persona_name, lifestyle, pains, desires, lingo_yes, lingo_no').eq('brand_id', brandId).order('display_order'),
    db.from('brand_competitors_detailed').select('name, ig_handle, they_do_well, is_direct_competitor, is_reference, is_anti_reference').eq('brand_id', brandId).order('display_order'),
  ]);

  if (!brand) throw new Error(`Brand not found: ${brandId}`);

  const ctx = brandToAgentContext(brand as Brand);

  ctx.faqs        = faqs        ?? [];
  ctx.products    = products    ?? [];
  ctx.personas    = personas    ?? [];
  ctx.competitors = competitors ?? [];
  ctx.complianceFlags = (brand as Record<string, unknown>).compliance_flags as Record<string, unknown> ?? {};
  ctx.services    = (brand as Record<string, unknown>).services as string[] ?? [];

  return { brand: brand as Brand, ctx };
}

/**
 * Guard at the top of every handler: ensures `job.brand_id` is present.
 * Returns a HandlerResult `fail` when missing so the handler body can early-return.
 */
export function requireBrandId(job: AgentJob): HandlerResult | string {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };
  return job.brand_id;
}

/**
 * Uniform wrapper: calls a run* function that returns { success, data?, error? }
 * and converts it to a HandlerResult. Handles the three real outcomes:
 *   - success + data → ok with a single output
 *   - success but no data → fail
 *   - failure → retry if transient, fail otherwise
 */
interface AgentRunResult<T> {
  success: boolean;
  data?:   T;
  error?:  { message?: string; code?: string };
}

export function toHandlerResult<T>(
  kind:   'post' | 'caption' | 'image' | 'video' | 'reply' | 'strategy' | 'analysis' | 'schedule',
  result: AgentRunResult<T>,
  opts:   { model?: string; preview_url?: string } = {},
): HandlerResult {
  if (result.success && result.data) {
    return {
      type: 'ok',
      outputs: [{
        kind,
        // Cast through unknown: agents return structured interfaces, but the
        // HandlerOutput contract stores them as opaque JSON blobs.
        payload:     result.data as unknown as Record<string, unknown>,
        preview_url: opts.preview_url,
        model:       opts.model,
      }],
    };
  }
  const msg = result.error?.message ?? 'Unknown agent error';
  const transient = /timeout|rate.?limit|ECONN|503|504|overloaded/i.test(msg);
  return transient
    ? { type: 'retry', error: msg }
    : { type: 'fail',  error: msg };
}
