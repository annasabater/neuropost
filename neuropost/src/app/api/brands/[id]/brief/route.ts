import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import type { BriefState } from '@/app/(auth)/onboarding/Step6BriefAvanzado';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const supabase = await createServerClient() as DB;

    // Verify ownership
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'brand not found' }, { status: 404 });

    const body = (await req.json()) as BriefState;

    // Replace strategy: delete existing rows, then bulk-insert.
    // Safe for onboarding (no prior data). The same endpoint reused from
    // /settings/brief will also do a full replace which is intentional.
    await Promise.all([
      supabase.from('brand_products').delete().eq('brand_id', id),
      supabase.from('brand_personas').delete().eq('brand_id', id),
      supabase.from('brand_competitors_detailed').delete().eq('brand_id', id),
      supabase.from('brand_faqs').delete().eq('brand_id', id),
    ]);

    const inserts: Promise<unknown>[] = [];

    if (body.products?.length) {
      inserts.push(
        supabase.from('brand_products').insert(
          body.products.map((p, i) => ({
            brand_id:      id,
            name:          p.name,
            category:      p.category,
            price_cents:   p.price_cents,
            currency:      p.currency ?? 'EUR',
            description:   p.description,
            main_benefit:  p.main_benefit,
            is_hero:       p.is_hero ?? false,
            display_order: i,
          })),
        ),
      );
    }

    if (body.personas?.length) {
      inserts.push(
        supabase.from('brand_personas').insert(
          body.personas.map((p, i) => ({
            brand_id:      id,
            persona_name:  p.persona_name,
            age_range:     p.age_range,
            gender:        p.gender,
            lifestyle:     p.lifestyle,
            pains:         p.pains,
            desires:       p.desires,
            lingo_yes:     p.lingo_yes,
            lingo_no:      p.lingo_no,
            display_order: i,
          })),
        ),
      );
    }

    if (body.competitors?.length) {
      inserts.push(
        supabase.from('brand_competitors_detailed').insert(
          body.competitors.map((c, i) => ({
            brand_id:             id,
            name:                 c.name,
            ig_handle:            c.ig_handle,
            they_do_well:         c.comment,
            is_direct_competitor: c.is_direct_competitor,
            is_reference:         c.is_reference,
            is_anti_reference:    c.is_anti_reference,
            display_order:        i,
          })),
        ),
      );
    }

    if (body.faqs?.length) {
      inserts.push(
        supabase.from('brand_faqs').insert(
          body.faqs
            .filter((f) => f.question.trim() && f.answer.trim())
            .map((f, i) => ({
              brand_id:      id,
              category:      f.category,
              question:      f.question,
              answer:        f.answer,
              display_order: i,
            })),
        ),
      );
    }

    await Promise.all(inserts);

    // Compute and store brief completion pct + compliance flags
    const { data: pctData } = await supabase.rpc('compute_brief_completion', {
      p_brand_id: id,
    });

    await supabase
      .from('brands')
      .update({
        compliance_flags:     body.compliance_flags ?? {},
        brief_completion_pct: pctData ?? 0,
      })
      .eq('id', id);

    return NextResponse.json({ ok: true, brief_completion_pct: pctData ?? 0 });
  } catch (err) {
    return apiError(err, 'brands/[id]/brief');
  }
}
