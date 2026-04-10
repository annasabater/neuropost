import type { SupabaseClient } from './supabase.ts';

export async function logAgent(
  sb: SupabaseClient,
  agentName: string,
  brandId: string | null,
  status: 'success' | 'error' | 'skipped',
  details: Record<string, unknown> = {},
  durationMs?: number,
) {
  await sb.from('agent_logs').insert({
    agent_name: agentName,
    brand_id: brandId,
    status,
    details,
    duration_ms: durationMs ?? null,
    created_at: new Date().toISOString(),
  });
}

export function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}
