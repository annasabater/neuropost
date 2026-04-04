import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { brandToAgentContext } from '@/lib/agentContext';
import { runEditorAgent } from '@neuropost/agents';
import type { EditorInput, Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as EditorInput;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    const { data: brand } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const result = await runEditorAgent(body, brandToAgentContext(brand as Brand));
    if (!result.success) return NextResponse.json({ error: result.error?.message }, { status: 500 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
