import { NextResponse }                                                     from 'next/server';
import { createAdminClient }                                                from '@/lib/supabase';
import { requireWorker, workerErrorResponse }                               from '@/lib/worker';
import {
  getHumanReviewDefaults,
  resolveHumanReviewConfig,
  HRC_UI_KEYS,
  type HrcUiKey,
}                                                                           from '@/lib/human-review';
import type { HumanReviewConfig }                                           from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface BrandRow {
  id:                  string;
  name:                string;
  human_review_config: Partial<HumanReviewConfig> | null;
}

export async function GET() {
  try {
    const worker = await requireWorker();
    const db     = createAdminClient() as DB;

    let query = db.from('brands')
      .select('id, name, human_review_config')
      .order('name', { ascending: true });

    if (worker.role === 'worker' && worker.brands_assigned?.length) {
      query = query.in('id', worker.brands_assigned);
    }

    const { data: brands, error } = await query;
    if (error) throw error;

    const defaults = await getHumanReviewDefaults(db);

    const enriched = (brands ?? []).map((b: BrandRow) => {
      const override  = b.human_review_config ?? null;
      const effective = resolveHumanReviewConfig(override, defaults);
      const diff_keys: HrcUiKey[] = HRC_UI_KEYS.filter((k) => {
        if (override === null) return false;
        return Object.prototype.hasOwnProperty.call(override, k);
      });
      return {
        id:                  b.id,
        name:                b.name,
        human_review_config: override,
        has_override:        override !== null && Object.keys(override).length > 0,
        effective,
        diff_keys,
      };
    });

    return NextResponse.json({ defaults, brands: enriched });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
