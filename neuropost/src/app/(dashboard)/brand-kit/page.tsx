// =============================================================================
// /brand-kit — Brand Kit Overview (Server Component)
// =============================================================================

import { redirect }            from 'next/navigation';
import { Suspense }            from 'react';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { calculateBrandHealth }                  from '@/lib/brand/health-score';
import { labelPlan }                             from '@/lib/brand/labels';
import type { Brand }                            from '@/types';

import { BrandKitHeader }       from '@/components/brand-kit/BrandKitHeader';
import { BrandHealthScore }     from '@/components/brand-kit/BrandHealthScore';
import { MaterialDeMarcaHero }  from '@/components/brand-kit/MaterialDeMarcaHero';
import { BrandKitSummaryGrid }  from '@/components/brand-kit/BrandKitSummaryGrid';
import { BrandKitEditor }       from '@/components/brand-kit/BrandKitEditor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export default async function BrandKitPage() {
  const user     = await requireServerUser();
  const supabase = await createServerClient() as DB;

  // Fetch brand
  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!brand) redirect('/onboarding');

  const typedBrand = brand as Brand;

  // Parallel fetches
  const [materialResult, rulesResult] = await Promise.all([
    supabase
      .from('brand_material')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', typedBrand.id),
    supabase
      .from('content_categories')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', typedBrand.id)
      .eq('active', true),
  ]);

  const materialCount      = (materialResult.count as number | null) ?? 0;
  const contentRulesCount  = (rulesResult.count  as number | null) ?? 0;

  const { score, missingItems } = calculateBrandHealth(
    typedBrand,
    materialCount,
    contentRulesCount,
  );

  // Last material update: fetch the most recent updated_at from brand_material
  const { data: lastMaterialRow } = await supabase
    .from('brand_material')
    .select('updated_at')
    .eq('brand_id', typedBrand.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastUpdatedAt: string | null = (lastMaterialRow as { updated_at: string } | null)?.updated_at ?? null;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BrandKitHeader
        brandName={typedBrand.name}
        planLabel={labelPlan(typedBrand.plan)}
      />
      <BrandHealthScore
        score={score}
        missingItems={missingItems}
      />
      <MaterialDeMarcaHero
        itemCount={materialCount}
        lastUpdatedAt={lastUpdatedAt}
        brandId={typedBrand.id}
      />
      <BrandKitSummaryGrid
        brand={typedBrand}
        contentRulesCount={contentRulesCount}
      />
      <Suspense fallback={null}>
        <BrandKitEditor />
      </Suspense>
    </div>
  );
}
