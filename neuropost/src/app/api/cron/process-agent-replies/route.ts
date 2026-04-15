// =============================================================================
// Cron: process agent replies and save to appropriate destination tables
// =============================================================================
// Runs every minute. Finds jobs with status = 'done' and output_delivered = false.
// For each job, extracts the generated output and saves it to the correct table:
// - support:handle_interactions → chat_messages, support_ticket_messages, or comments
// - content:generate_ideas → special_requests or recreation_requests
//
// Includes fallback response generation for professional UX when agents don't
// generate replies (e.g., ignoring casual greetings) but clients still need responses.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { handleEscalation } from '@/lib/soporte/escalation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface AgentJob {
  id: string;
  brand_id: string | null;
  agent_type: string;
  action: string;
  input: Record<string, unknown>;
  status: string;
  finished_at: string | null;
}

interface AgentOutput {
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

// Fallback replies by category and language (for when agent decides to ignore)
const FALLBACK_REPLIES: Record<string, Record<string, string>> = {
  general: {
    es: '¡Hola! 👋 Gracias por escribirnos. ¿En qué podemos ayudarte?',
    en: 'Hi! 👋 Thanks for reaching out. How can we help you?',
    fr: 'Bonjour! 👋 Merci de nous contacter. Comment pouvons-nous vous aider?',
    pt: 'Olá! 👋 Obrigado por nos contatar. Como podemos ajudá-lo?',
    ca: 'Hola! 👋 Gràcies per escriure\'ns. Com podem ajudar-te?',
  },
  question: {
    es: '¡Hola! Gracias por tu pregunta. El equipo te responderá pronto. 📧',
    en: 'Hi! Thanks for your question. Our team will get back to you soon. 📧',
    fr: 'Bonjour! Merci pour ta question. Notre équipe te répondra bientôt. 📧',
    pt: 'Olá! Obrigado pela sua pergunta. Nossa equipe responderá em breve. 📧',
    ca: 'Hola! Gràcies per la teva pregunta. L\'equip et respon aviat. 📧',
  },
  compliment: {
    es: '¡Gracias! Significa mucho para nosotros. 😊',
    en: 'Thank you! It means a lot to us. 😊',
    fr: 'Merci! Cela signifie beaucoup pour nous. 😊',
    pt: 'Obrigado! Significa muito para nós. 😊',
    ca: 'Gràcies! Significa molt per a nosaltres. 😊',
  },
  complaint: {
    es: 'Sentimos oír eso. Nuestro equipo se pondrá en contacto contigo para resolverlo. 🤝',
    en: 'We\'re sorry to hear that. Our team will get in touch with you to resolve this. 🤝',
    fr: 'Nous sommes désolés d\'entendre cela. Notre équipe te contactera pour résoudre ce problème. 🤝',
    pt: 'Desculpa ouvir isso. Nossa equipe entrará em contato para resolver. 🤝',
    ca: 'Sentim sentir això. L\'equip es posarà en contacte per resoldre-ho. 🤝',
  },
};

function getFallbackReply(category: string, language: string): string {
  const replies = FALLBACK_REPLIES[category] || FALLBACK_REPLIES['general'];
  return replies[language] || replies['es'];
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient() as DB;
  let processed = 0;

  try {
    // Query all done jobs that haven't had their outputs saved yet
    const { data: jobs, error: jobsError } = await db
      .from('agent_jobs')
      .select('*')
      .eq('status', 'done')
      .eq('output_delivered', false)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(50);

    if (jobsError) throw jobsError;
    if (!jobs?.length) {
      return NextResponse.json({ processed: 0, message: 'No jobs to process' });
    }

    for (const job of jobs as AgentJob[]) {
      try {
        // Get the outputs for this job
        const { data: outputs, error: outputsError } = await db
          .from('agent_outputs')
          .select('*')
          .eq('job_id', job.id)
          .order('created_at', { ascending: true });

        if (outputsError) {
          console.error(`[process-agent-replies] Error fetching outputs for job ${job.id}:`, outputsError);
          continue;
        }

        if (!outputs?.length) {
          // Mark as delivered even if no outputs (job might have had no result to save)
          await db.from('agent_jobs').update({ output_delivered: true }).eq('id', job.id);
          processed++;
          continue;
        }

        // Dispatch by agent type + action + source
        const agentType = job.agent_type as string;
        const action = job.action as string;
        const source = job.input?.source as string;

        if (agentType === 'support' && action === 'handle_interactions') {
          await processSupportInteraction(db, job, outputs[0] as AgentOutput);
        } else if (agentType === 'content' && action === 'generate_ideas') {
          await processContentIdeas(db, job, outputs[0] as AgentOutput);
        }

        // Mark job as delivered
        await db.from('agent_jobs').update({ output_delivered: true }).eq('id', job.id);
        processed++;
      } catch (err) {
        console.error(`[process-agent-replies] Error processing job ${job.id}:`, err);
        continue;
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      message: `Processed ${processed} agent outputs`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[process-agent-replies]', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─── Handlers by job type ──────────────────────────────────────────────────

async function processSupportInteraction(db: DB, job: AgentJob, output: AgentOutput) {
  const source = job.input?.source as string;
  const payload = output.payload as {
    responses?: Array<{ generatedReply?: string; analysis?: { decision?: string; detectedLanguage?: string } }>;
  };

  const responses = payload.responses || [];
  const response = responses[0];
  if (!response) return;

  const generatedReply = response.generatedReply || '';
  const decision = response.analysis?.decision || 'auto_respond';
  const detectedLanguage = response.analysis?.detectedLanguage || 'es';

  // Generate fallback reply if agent didn't generate one
  let finalReply = generatedReply;
  if (!finalReply && source === 'comment') {
    const category = (response.analysis as any)?.category || 'general';
    finalReply = getFallbackReply(category, detectedLanguage);
  }

  if (!finalReply) return; // Don't save empty replies unless it's a fallback

  console.log(`[process-agent-replies] Job ${job.id}: source=${source}, reply=${finalReply?.slice(0, 50)}...`);

  if (source === 'chat') {
    // Save to chat_messages — skip dedup check on first insert for reliability
    const { error: insertError } = await db.from('chat_messages').insert({
      brand_id: job.brand_id,
      sender_id: null,
      sender_type: 'worker',
      message: finalReply,
      attachments: [],
      metadata: { job_id: job.id },
    });

    if (insertError) {
      console.error(`[process-agent-replies] FAILED to insert chat_message for job ${job.id}:`, insertError);
      throw new Error(`chat_messages insert failed: ${insertError.message}`);
    }
    console.log(`[process-agent-replies] ✅ Saved chat reply for job ${job.id}`);

  } else if (source === 'ticket' || source === 'ticket_message') {
    const ticketId = job.input?.ticket_id as string;
    if (!ticketId) {
      console.warn(`[process-agent-replies] Job ${job.id}: no ticket_id in input, skipping`);
      return;
    }

    const { error: insertError } = await db.from('support_ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: null,
      sender_type: 'worker',
      message: finalReply,
      metadata: { job_id: job.id },
    });

    if (insertError) {
      console.error(`[process-agent-replies] FAILED to insert ticket_message for job ${job.id}:`, insertError);
      throw new Error(`ticket_messages insert failed: ${insertError.message}`);
    }
    console.log(`[process-agent-replies] ✅ Saved ticket reply for job ${job.id}`);

  } else if (source === 'comment') {
    const externalId = job.input?.external_id as string;
    if (!externalId) return;

    const newStatus = decision === 'escalate' ? 'escalated' : 'replied';
    const { error: updateError } = await db
      .from('comments')
      .update({ ai_reply: finalReply, status: newStatus })
      .eq('external_id', externalId);

    if (updateError) {
      console.error(`[process-agent-replies] FAILED to update comment for job ${job.id}:`, updateError);
      throw new Error(`comments update failed: ${updateError.message}`);
    }
    console.log(`[process-agent-replies] ✅ Saved comment reply for job ${job.id}`);

  } else {
    console.warn(`[process-agent-replies] Job ${job.id}: unknown source '${source}', skipping`);
  }

  // Escalation: if agent decided to escalate, create incident + send email
  if (decision === 'escalate') {
    const interactions = (job.input?.interactions as Array<{ text?: string; authorId?: string }>) ?? [];
    const mensajeOriginal = interactions[0]?.text ?? '';
    const category = (response.analysis as Record<string, unknown>)?.category as string ?? 'general';
    const sentiment = (response.analysis as Record<string, unknown>)?.sentiment as string ?? 'negative';

    handleEscalation({
      brandId: job.brand_id ?? '',
      jobId: job.id,
      userId: interactions[0]?.authorId,
      source: source ?? 'unknown',
      mensajeOriginal,
      respuestaAgente: finalReply,
      category,
      sentiment,
    }).catch(err => console.error(`[process-agent-replies] Escalation failed for job ${job.id}:`, err));
  }
}

async function processContentIdeas(db: DB, job: AgentJob, output: AgentOutput) {
  const source = job.input?.source as string;
  const payload = output.payload as { ideas?: Array<{ title: string; caption?: string; hashtags?: string[]; format?: string }> };

  const ideas = payload.ideas || [];
  if (!ideas.length) return;

  // Format top 3 ideas as worker response
  const workerResponse = ideas
    .slice(0, 3)
    .map((idea, i) => {
      const format = idea.format ? ` (${idea.format})` : '';
      const caption = idea.caption ? `\n${idea.caption}` : '';
      const hashtags = idea.hashtags?.length ? `\nHashtags: ${idea.hashtags.join(' ')}` : '';
      return `**Idea ${i + 1}: ${idea.title}**${format}${caption}${hashtags}`;
    })
    .join('\n\n---\n\n');

  if (source === 'special_request') {
    const requestId = job.input?.request_id as string;
    if (!requestId) return;

    await db.from('special_requests').update({ worker_response: workerResponse }).eq('id', requestId);
  } else if (source === 'recreation_request') {
    const recreationId = job.input?.recreation_id as string;
    if (!recreationId) return;

    await db.from('recreation_requests').update({ worker_notes: workerResponse }).eq('id', recreationId);
  }
}
