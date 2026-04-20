import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import { runPlannerAgent } from '@neuropost/agents';
import type { PlannerInput, Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    const user     = await requireServerUser();
    const body     = await request.json() as Partial<PlannerInput>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const input: PlannerInput = {
      month:         body.month         ?? new Date().getMonth() + 1,
      year:          body.year          ?? new Date().getFullYear(),
      postsPerWeek:  body.postsPerWeek  ?? 3,
      platforms:     body.platforms     ?? ['instagram'],
      country:       body.country       ?? 'ES',
      blackoutDates: body.blackoutDates ?? [],
      contentPieces: body.contentPieces ?? [
        { id: 'auto-1', goal: 'engagement', platforms: ['instagram'], visualTags: ['producto', 'marca'] },
        { id: 'auto-2', goal: 'awareness',  platforms: ['instagram'], visualTags: ['equipo', 'historia'] },
        { id: 'auto-3', goal: 'promotion',  platforms: ['instagram'], visualTags: ['oferta', 'promo'] },
      ],
      // TODO [FASE 2]: Facebook — add facebook to platforms and contentPieces
    };

    const result = await runPlannerAgent(input, brandToAgentContext(brand as Brand));
    if (!result.success) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 'POST /api/agents/planner');
  }
}
