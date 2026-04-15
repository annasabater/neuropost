// =============================================================================
// GET /api/worker/agent-jobs  — list all agent jobs (worker portal)
// =============================================================================
// Worker-only. Supports optional filters by status, agent_type, and brand_id.
// Paginated via `limit` (capped at 200) and `before` (created_at cursor).

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireWorker } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import type { AgentJobStatus, AgentType } from '@/lib/agents/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    await requireWorker();

    const { searchParams } = new URL(request.url);
    const status     = searchParams.get('status')     as AgentJobStatus | null;
    const agentType  = searchParams.get('agent_type') as AgentType      | null;
    const brandId    = searchParams.get('brand_id');
    const before     = searchParams.get('before');   // ISO timestamp cursor
    const limit      = Math.min(Number(searchParams.get('limit') ?? 50), 200);

    const db = createAdminClient() as DB;
    let q = db
      .from('agent_jobs')
      .select('*, brands(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status)    q = q.eq('status', status);
    if (agentType) q = q.eq('agent_type', agentType);
    if (brandId)   q = q.eq('brand_id', brandId);
    if (before)    q = q.lt('created_at', before);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ jobs: data ?? [] });
  } catch (err) {
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[GET /api/worker/agent-jobs]', err);
    return apiError(err, 'worker/agent-jobs');
  }
}
