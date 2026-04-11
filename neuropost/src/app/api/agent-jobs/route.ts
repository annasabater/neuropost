// =============================================================================
// POST /api/agent-jobs   — enqueue a new agent job
// GET  /api/agent-jobs   — list my brand's recent jobs
// =============================================================================
// Client-facing endpoint. Authenticated as the brand owner. The orchestrator
// handles validation, plan gate, and queue insertion.

import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { orchestrateJob } from '@/lib/agents/orchestrator';
import { listJobsByBrand } from '@/lib/agents/queue';
import type { AgentJobStatus, AgentType } from '@/lib/agents/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface CreateJobBody {
  agent_type:     AgentType;
  action:         string;
  input?:         Record<string, unknown>;
  priority?:      number;
  scheduled_for?: string;
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const body = await request.json() as CreateJobBody;

    if (!body.agent_type || !body.action) {
      return NextResponse.json(
        { error: 'agent_type and action are required' },
        { status: 400 },
      );
    }

    // Resolve the caller's brand — one brand per user in this product.
    const db = createAdminClient() as DB;
    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const result = await orchestrateJob({
      brand_id:      brand.id,
      agent_type:    body.agent_type,
      action:        body.action,
      input:         body.input,
      priority:      body.priority,
      scheduled_for: body.scheduled_for,
      requested_by:  'client',
      requester_id:  user.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, upgradeUrl: 'upgradeUrl' in result ? result.upgradeUrl : undefined },
        { status: result.status },
      );
    }

    return NextResponse.json({ job: result.job }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[POST /api/agent-jobs]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as AgentJobStatus | null;
    const limit       = Math.min(Number(searchParams.get('limit') ?? 50), 100);

    const db = createAdminClient() as DB;
    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const jobs = await listJobsByBrand(brand.id, {
      status: statusParam ?? undefined,
      limit,
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[GET /api/agent-jobs]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
