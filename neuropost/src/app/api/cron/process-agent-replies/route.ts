// =============================================================================
// Cron: process agent replies and save as chat messages
// =============================================================================
// Runs every minute. Finds jobs with status = 'done' and agent_type = 'support',
// extracts generated replies from agent_outputs, and saves them as worker
// messages in chat_messages so both client and worker see the conversation.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface AgentOutput {
  id: string;
  job_id: string;
  brand_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
}

interface AgentJob {
  id: string;
  brand_id: string | null;
  agent_type: string;
  action: string;
  input: Record<string, unknown>;
  status: string;
  finished_at: string | null;
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient() as DB;
  let processed = 0;

  try {
    // Get all support jobs that finished recently and haven't been processed yet
    const { data: jobs, error: jobsError } = await db
      .from('agent_jobs')
      .select('*')
      .eq('agent_type', 'support')
      .eq('status', 'done')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(50);

    if (jobsError) throw jobsError;
    if (!jobs?.length) {
      return NextResponse.json({ processed: 0, message: 'No jobs to process' });
    }

    for (const job of jobs) {
      try {
        // Get the outputs for this job
        const { data: outputs, error: outputsError } = await db
          .from('agent_outputs')
          .select('*')
          .eq('job_id', job.id)
          .eq('kind', 'reply');

        if (outputsError) {
          console.error(`[process-agent-replies] Error fetching outputs for job ${job.id}:`, outputsError);
          continue;
        }

        if (!outputs?.length) continue;

        // Extract the reply text from the first output
        const output = outputs[0] as AgentOutput;
        const payload = output.payload as {
          generatedReply?: string;
          reply?: string;
          message?: string;
          text?: string;
        };

        const replyText = payload.generatedReply
          || payload.reply
          || payload.message
          || payload.text
          || JSON.stringify(payload);

        if (!replyText || !job.brand_id) continue;

        // Check if a worker message for this job already exists to avoid duplicates
        const { data: existing } = await db
          .from('chat_messages')
          .select('id')
          .eq('brand_id', job.brand_id)
          .eq('sender_type', 'worker')
          .eq('metadata', JSON.stringify({ job_id: job.id }))
          .maybeSingle();

        if (existing) continue;

        // Save the reply as a worker message in chat_messages
        const { error: insertError } = await db.from('chat_messages').insert({
          brand_id: job.brand_id,
          sender_id: null, // System/agent-generated
          sender_type: 'worker',
          message: typeof replyText === 'string' ? replyText : JSON.stringify(replyText),
          attachments: [],
          metadata: { job_id: job.id, agent_output_id: output.id },
        });

        if (insertError) {
          console.error(`[process-agent-replies] Error inserting message for job ${job.id}:`, insertError);
          continue;
        }

        processed++;
      } catch (err) {
        console.error(`[process-agent-replies] Error processing job ${job.id}:`, err);
        continue;
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      message: `Processed ${processed} agent replies`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-agent-replies]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
