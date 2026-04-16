// =============================================================================
// POST /api/agent-jobs   — enqueue via intent OR direct mode
// GET  /api/agent-jobs   — list my brand's recent jobs
// =============================================================================
// Client-facing endpoint. Accepts two body shapes:
//
//   Intent mode (recommended):
//   { "intent": "create_reel", "input": { "topic": "rutina piernas" } }
//
//   Direct mode (backwards-compatible):
//   { "agent_type": "content", "action": "generate_caption", "input": {...} }

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { orchestrateJob } from '@/lib/agents/orchestrator';
import { listJobsByBrand } from '@/lib/agents/queue';
import type { AgentJobStatus, AgentType } from '@/lib/agents/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface DirectBody {
  agent_type:     AgentType;
  action:         string;
  input?:         Record<string, unknown>;
  priority?:      number;
  scheduled_for?: string;
}

interface IntentBody {
  intent: string;
  input?: Record<string, unknown>;
}

type CreateJobBody = DirectBody | IntentBody;

function isIntentBody(b: CreateJobBody): b is IntentBody {
  return 'intent' in b && typeof (b as IntentBody).intent === 'string';
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const body = await request.json() as CreateJobBody;

    // Validate that the body has at least one valid shape.
    if (!isIntentBody(body) && (!(body as DirectBody).agent_type || !(body as DirectBody).action)) {
      return NextResponse.json(
        { error: 'Provide either { intent } or { agent_type, action }' },
        { status: 400 },
      );
    }

    const db = createAdminClient() as DB;
    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const result = isIntentBody(body)
      ? await orchestrateJob({
          brand_id:     brand.id,
          intent:       body.intent,
          input:        body.input,
          requested_by: 'client',
          requester_id: user.id,
        })
      : await orchestrateJob({
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

    return NextResponse.json({ jobs: result.jobs }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[POST /api/agent-jobs]', err);
    return apiError(err, 'agent-jobs');
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
    return apiError(err, 'agent-jobs');
  }
}
