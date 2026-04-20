import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';

// Health Orchestrator — no LLM, pure logic
// Checks: stuck proposals, failed posts, token expiration, agent errors

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();
  const issues: string[] = [];

  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Stuck proposals (processing for > 2 hours)
    const { data: stuck } = await sb
      .from('proposals')
      .select('id, status, brand_id')
      .in('status', ['processing_copy', 'generating_visual', 'processing_qc'])
      .lt('created_at', twoHoursAgo);

    if (stuck?.length) {
      // Reset stuck proposals to retry
      for (const s of stuck) {
        const resetStatus = s.status === 'processing_copy' ? 'pending_copy'
          : s.status === 'generating_visual' ? 'pending_visual'
          : 'pending_qc';
        await sb.from('proposals').update({ status: resetStatus }).eq('id', s.id);
      }
      issues.push(`Reset ${stuck.length} stuck proposals`);
    }

    // 2. Failed proposals (> 3 retries in last 24h)
    const { count: failedCount } = await sb
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo);

    if ((failedCount ?? 0) > 5) {
      issues.push(`${failedCount} proposals failed in last 24h — check agent logs`);
    }

    // 3. Agent errors in last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count: errorCount } = await sb
      .from('agent_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', oneHourAgo);

    if ((errorCount ?? 0) > 10) {
      issues.push(`${errorCount} agent errors in last hour`);
    }

    // 4. Scheduled posts that should have published but didn't
    const { data: overduePublish } = await sb
      .from('posts')
      .select('id, brand_id')
      .eq('status', 'scheduled')
      .lt('scheduled_at', now.toISOString());

    if (overduePublish?.length) {
      issues.push(`${overduePublish.length} overdue scheduled posts`);
      // Could trigger publisher here
    }

    // 5. Meta tokens expiring in < 7 days
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringTokens } = await sb
      .from('brands')
      .select('id, name')
      .not('meta_token_expires_at', 'is', null)
      .lt('meta_token_expires_at', sevenDaysFromNow);

    if (expiringTokens?.length) {
      issues.push(`${expiringTokens.length} Meta tokens expiring within 7 days`);
      // Notify owners
      for (const b of expiringTokens) {
        const { data: brandData } = await sb.from('brands').select('user_id').eq('id', b.id).single();
        if (brandData?.user_id) {
          await sb.from('notifications').insert({
            user_id: brandData.user_id,
            type: 'token_expiring',
            title: 'Tu conexión con Instagram expira pronto',
            body: 'Reconecta tu cuenta desde Ajustes > Conexiones para evitar interrupciones',
            data: { brand_id: b.id },
          });
        }
      }
    }

    const status = issues.length > 0 ? 'warning' : 'healthy';
    await logAgent(sb, 'health', null, issues.length > 0 ? 'error' : 'success', { issues, status }, elapsed());

    return json({ status, issues });
  } catch (err) {
    await logAgent(sb, 'health', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
