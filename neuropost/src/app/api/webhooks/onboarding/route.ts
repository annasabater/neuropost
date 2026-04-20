// =============================================================================
// POST /api/webhooks/onboarding — trigger onboarding pipeline for a new brand
// =============================================================================
// Called after a brand completes registration/onboarding. Can be triggered:
//   • From the onboarding flow's final step (frontend POST)
//   • From a Supabase database webhook on brands INSERT
//   • Manually by a worker from the admin panel
//
// Requires authentication (brand owner or CRON_SECRET for webhooks).

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { queueOnboardingPipeline } from '@/lib/agents/pipelines/onboarding';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    // Support both user-session auth and service auth (for DB webhooks).
    const authHeader = request.headers.get('authorization');
    let brandId: string | null = null;

    if (authHeader === `Bearer ${process.env.CRON_SECRET ?? ''}`) {
      // Service/webhook call — brand_id must be in body.
      const body = await request.json() as { brand_id?: string };
      brandId = body.brand_id ?? null;
    } else {
      // User session — resolve their brand.
      const user = await requireServerUser();
      const db = createAdminClient() as DB;
      const { data: brand } = await db
        .from('brands').select('id').eq('user_id', user.id).single();
      if (!brand) {
        return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      }
      brandId = brand.id;
    }

    if (!brandId) {
      return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
    }

    // Prevent running onboarding twice — check if a build_taxonomy job
    // already exists for this brand.
    const db = createAdminClient() as DB;
    const { data: existing } = await db
      .from('agent_jobs')
      .select('id')
      .eq('brand_id', brandId)
      .eq('action', 'build_taxonomy')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Onboarding pipeline already ran for this brand.',
      });
    }

    const result = await queueOnboardingPipeline(brandId);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[POST /api/webhooks/onboarding]', err);
    return apiError(err, 'webhooks/onboarding');
  }
}
