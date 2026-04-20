// =============================================================================
// F8 — Advanced agent handlers
// =============================================================================
// Four value-add features layered on top of the base agents:
//
//   content:ab_test_captions   — generate 2 caption variants (A/B)
//   content:repurpose_top_post — detect high-performer, emit repurpose sub-jobs
//   analytics:predict_engagement — fast Haiku classifier: top/mid/bottom
//   growth:churn_risk_scan     — identify inactive brands and emit emails
//
// These compose existing handlers where possible (ab_test fans out two
// copywriter sub-jobs) and only call the LLM directly when the semantics
// don't fit an existing agent (predict_engagement).

import Anthropic from '@anthropic-ai/sdk';
import { registerHandler } from '../registry';
import { createAdminClient } from '@/lib/supabase';
import { loadBrand } from '../helpers';
import type { AgentHandler, AgentJob, HandlerResult, HandlerSubJob } from '../types';

const client = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// -----------------------------------------------------------------------------
// content:ab_test_captions
// -----------------------------------------------------------------------------
// Emits two content:generate_caption sub-jobs with different "goal" hints
// (engagement vs conversion) so the copywriter produces two meaningfully
// different angles. The UI can then A/B publish them.
// -----------------------------------------------------------------------------

const abTestCaptionsHandler: AgentHandler = async (job) => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as { topic?: string; category_key?: string };
  if (!input.topic) return { type: 'fail', error: 'topic is required' };

  const base: HandlerSubJob = {
    agent_type: 'content',
    action:     'generate_caption',
    priority:   Math.max(job.priority, 60),
    input: {
      topic:        input.topic,
      category_key: input.category_key,
      platforms:    ['instagram'],
      brand_id:     job.brand_id,
    },
  };

  const subJobs: HandlerSubJob[] = [
    { ...base, input: { ...base.input, goal: 'engagement', variant: 'A' } },
    { ...base, input: { ...base.input, goal: 'conversion', variant: 'B' } },
  ];

  return {
    type: 'ok',
    outputs: [{
      kind:    'analysis',
      payload: {
        experiment: 'caption_ab',
        variants:   2,
        topic:      input.topic,
      } as unknown as Record<string, unknown>,
      model: 'orchestrator',
    }],
    sub_jobs: subJobs,
  };
};

// -----------------------------------------------------------------------------
// content:repurpose_top_post
// -----------------------------------------------------------------------------
// Finds the brand's top-performing post in the last 30 days and fans out
// sub-jobs to turn it into other formats:
//   • caption for stories
//   • new reel prompt (but NO auto-generate — user trigger)
//   • carousel outline from the original caption
// -----------------------------------------------------------------------------

const repurposeHandler: AgentHandler = async (job) => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  try {
    const db = createAdminClient() as DB;

    // Top by engagement_rate in the last 30 days.
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: rows } = await db
      .from('post_analytics')
      .select('post_id, engagement_rate, format, category_key')
      .eq('brand_id', job.brand_id)
      .gte('published_at', cutoff)
      .not('engagement_rate', 'is', null)
      .order('engagement_rate', { ascending: false })
      .limit(1);

    const top = ((rows ?? []) as Array<{
      post_id: string; engagement_rate: number; format: string | null; category_key: string | null;
    }>)[0];
    if (!top) {
      return {
        type: 'needs_review',
        reason: 'No hay datos de engagement en los últimos 30 días — imposible elegir post top.',
      };
    }

    const { data: post } = await db
      .from('posts')
      .select('id, caption, hashtags, image_url, edited_image_url, format')
      .eq('id', top.post_id)
      .maybeSingle();
    if (!post) {
      return { type: 'fail', error: `Top post not found: ${top.post_id}` };
    }

    // Fan-out: reuse the copy, change the angle.
    const subJobs: HandlerSubJob[] = [
      {
        agent_type: 'content',
        action:     'generate_caption',
        priority:   60,
        input: {
          topic:         `Reaprovecha este post top: "${(post.caption ?? '').slice(0, 120)}"`,
          category_key:  top.category_key,
          platforms:     ['instagram'],
          goal:          'engagement',
          variant:       'repurpose',
          brand_id:      job.brand_id,
        },
      },
    ];

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: {
          experiment:       'repurpose',
          source_post_id:   top.post_id,
          source_engagement: top.engagement_rate,
          source_format:    top.format,
        } as unknown as Record<string, unknown>,
        model: 'orchestrator',
      }],
      sub_jobs: subJobs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'fail', error: msg };
  }
};

// -----------------------------------------------------------------------------
// analytics:predict_engagement
// -----------------------------------------------------------------------------
// Fast Haiku classifier that predicts a bucket (top / mid / bottom) for a
// given caption + brand context. Designed to run BEFORE publishing so the
// UI can warn "this is predicted to underperform" and let the user regenerate.
// -----------------------------------------------------------------------------

const PREDICT_SYSTEM = `Eres un predictor de engagement para posts de Instagram. Recibes el contexto de una marca y un borrador de caption. Devuelve SOLO JSON:

{ "bucket": "top" | "mid" | "bottom", "confidence": 0.0-1.0, "reason": "1 frase" }

Reglas:
- "top"    = esperado en el top 30% de posts del brand
- "mid"    = esperado en el medio 40%
- "bottom" = esperado en el bottom 30%
- "confidence" refleja tu certeza (0.5 = muy incierto, 1.0 = muy seguro)
- "reason" debe mencionar el factor CONCRETO (hook, formato, claridad del CTA, etc.)
- NO incluyas markdown, texto fuera del JSON, ni comentarios`;

const predictEngagementHandler: AgentHandler = async (job) => {
  const input = job.input as {
    caption?: string;
    format?:  string;
    category_key?: string;
    sector?:  string;
  };
  if (!input.caption) return { type: 'fail', error: 'caption is required' };

  try {
    let sectorHint = input.sector;
    if (!sectorHint && job.brand_id) {
      const brand = await loadBrand(job.brand_id);
      sectorHint = brand?.sector ?? 'unknown';
    }

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     PREDICT_SYSTEM,
      messages: [{
        role:    'user',
        content: [
          `Sector: ${sectorHint ?? 'unknown'}`,
          input.category_key ? `Categoría: ${input.category_key}` : '',
          input.format ? `Formato: ${input.format}` : '',
          '',
          'Caption:',
          input.caption,
        ].filter(Boolean).join('\n'),
      }],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('LLM returned no text content');
    }
    const cleaned = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as {
      bucket?: string; confidence?: number; reason?: string;
    };
    if (!parsed.bucket || !['top', 'mid', 'bottom'].includes(parsed.bucket)) {
      throw new Error(`Invalid bucket: ${parsed.bucket}`);
    }

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: parsed as unknown as Record<string, unknown>,
        model:   'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
};

// -----------------------------------------------------------------------------
// growth:churn_risk_scan
// -----------------------------------------------------------------------------
// Not a LLM handler — pure DB logic. Emits growth:retention_email sub-jobs
// for any brand this job's brand has as... wait. This is a per-brand handler,
// but churn scanning is a global operation. We model it as: this handler
// runs FOR ONE brand and checks THAT brand's own churn signals.
//
// Inputs: { inactivity_days?: number } (default 14)
// Output: { at_risk: boolean, days_since_last_post: number, ... }
// -----------------------------------------------------------------------------

const churnRiskHandler: AgentHandler = async (job) => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const inactivityDays = Number((job.input as { inactivity_days?: number }).inactivity_days ?? 14);

  try {
    const db = createAdminClient() as DB;

    const { data: latest } = await db
      .from('posts')
      .select('published_at')
      .eq('brand_id', job.brand_id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPublishedAt = (latest as { published_at: string } | null)?.published_at ?? null;
    const daysSince = lastPublishedAt
      ? Math.floor((Date.now() - new Date(lastPublishedAt).getTime()) / 86_400_000)
      : Infinity;

    const atRisk = daysSince >= inactivityDays;

    const subJobs: HandlerSubJob[] = atRisk
      ? [{
          agent_type: 'growth',
          action:     'retention_email',
          priority:   70,
          input: {
            brand_id:  job.brand_id,
            days_since_last_post: Number.isFinite(daysSince) ? daysSince : null,
          },
        }]
      : [];

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: {
          at_risk:              atRisk,
          days_since_last_post: Number.isFinite(daysSince) ? daysSince : null,
          threshold_days:       inactivityDays,
          last_published_at:    lastPublishedAt,
        } as unknown as Record<string, unknown>,
        model: 'rule-based-churn',
      }],
      sub_jobs: subJobs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'fail', error: msg };
  }
};

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

export function registerAdvancedHandlers(): void {
  registerHandler({ agent_type: 'content',   action: 'ab_test_captions'   }, abTestCaptionsHandler);
  registerHandler({ agent_type: 'content',   action: 'repurpose_top_post' }, repurposeHandler);
  registerHandler({ agent_type: 'analytics', action: 'predict_engagement' }, predictEngagementHandler);
  registerHandler({ agent_type: 'growth',    action: 'churn_risk_scan'    }, churnRiskHandler);
}
