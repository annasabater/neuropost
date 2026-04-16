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

        if (agentType === 'support' && action === 'resolve_ticket') {
          await processSupportResolveTicket(db, job, outputs[0] as AgentOutput);
        } else if (agentType === 'support' && action === 'handle_interactions') {
          await processSupportInteraction(db, job, outputs[0] as AgentOutput);
        } else if (agentType === 'content' && action === 'generate_ideas') {
          await processContentIdeas(db, job, outputs[0] as AgentOutput);
        } else if (agentType === 'content' && action === 'generate_caption' && job.input?._ab_test_id) {
          await processAbTestVariant(db, job, outputs[0] as AgentOutput);
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
    responses?: Array<{ generatedReply?: string; analysis?: { decision?: string; detectedLanguage?: string; category?: string } }>;
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
    const category = response.analysis?.category || 'general';
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

    // Notify client of new agent message
    await db.from('notifications').insert({
      brand_id: job.brand_id,
      type: 'chat_message',
      message: `Nuevo mensaje del equipo de NeuroPost: "${finalReply.slice(0, 60)}${finalReply.length > 60 ? '...' : ''}"`,
      read: false,
      metadata: { job_id: job.id },
    }).then(() => null);

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

    // Notify client of ticket reply
    await db.from('notifications').insert({
      brand_id: job.brand_id,
      type: 'ticket_reply',
      message: `Respuesta en tu ticket de soporte: "${finalReply.slice(0, 60)}${finalReply.length > 60 ? '...' : ''}"`,
      read: false,
      metadata: { job_id: job.id, ticket_id: ticketId },
    }).then(() => null);

  } else if (source === 'comment') {
    const externalId = job.input?.external_id as string;
    if (!externalId) return;

    // Moderation: approve, reject, or escalate based on agent decision
    let newStatus: string;
    if (decision === 'escalate') {
      newStatus = 'escalated';
    } else if (decision === 'ignore') {
      newStatus = 'rejected';
    } else {
      newStatus = 'approved';
    }

    const { error: updateError } = await db
      .from('comments')
      .update({ ai_reply: finalReply, status: newStatus })
      .eq('external_id', externalId);

    if (updateError) {
      console.error(`[process-agent-replies] FAILED to update comment for job ${job.id}:`, updateError);
      throw new Error(`comments update failed: ${updateError.message}`);
    }
    console.log(`[process-agent-replies] ✅ Comment ${externalId} → ${newStatus} for job ${job.id}`);

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

// ─────────────────────────────────────────────────────────────────────────────
// SupportAgent resolve_ticket — for /api/soporte + /api/chat flows.
// The new support action always returns { reply, solutions, ... } with a
// non-empty `reply`. We post it back to the client and optionally ping the
// worker team if the agent flagged it for human follow-up.
// ─────────────────────────────────────────────────────────────────────────────

interface SupportResolvePayload {
  reply?: string;
  category?: string;
  sentiment?: string;
  language?: string;
  solutions?: Array<{ title: string; steps: string[]; link?: string }>;
  needsHumanFollowUp?: boolean;
  escalationReason?: string;
  resolved?: boolean;
}

async function processSupportResolveTicket(db: DB, job: AgentJob, output: AgentOutput) {
  const source = job.input?.source as string;
  const payload = output.payload as SupportResolvePayload;

  const reply = (payload.reply ?? '').trim();
  if (!reply) {
    // Defensive: SupportAgent has its own fallback, so this should never fire.
    // If it does, at least log and notify the worker team so no client is left hanging.
    console.error(`[process-agent-replies] SupportAgent job ${job.id} produced empty reply`);
    await db.from('worker_notifications').insert({
      type:       'support_needs_attention',
      message:    `El agente de soporte no pudo generar respuesta (job ${job.id}). Revisa manualmente.`,
      brand_id:   job.brand_id,
      brand_name: null,
      read:       false,
      metadata:   { job_id: job.id, source, ticket_id: job.input?.ticket_id ?? null },
    }).then(() => null).catch(() => null);
    return;
  }

  const needsHumanFollowUp = payload.needsHumanFollowUp === true;
  const escalationReason   = payload.escalationReason ?? null;
  const category           = payload.category ?? 'other';
  const solutions          = Array.isArray(payload.solutions) ? payload.solutions : [];

  console.log(`[process-agent-replies] SupportAgent job ${job.id}: source=${source}, category=${category}, resolved=${payload.resolved}, handover=${needsHumanFollowUp}`);

  // ── Insert the reply into the right table ────────────────────────────────
  if (source === 'ticket') {
    const ticketId = job.input?.ticket_id as string;
    if (!ticketId) {
      console.warn(`[process-agent-replies] Job ${job.id}: ticket source but no ticket_id`);
      return;
    }

    const { error: insertError } = await db.from('support_ticket_messages').insert({
      ticket_id:   ticketId,
      sender_id:   null,
      sender_type: 'worker',
      message:     reply,
      metadata:    {
        job_id:              job.id,
        agent:               'support',
        category,
        solutions,
        needs_human_follow_up: needsHumanFollowUp,
      },
    });
    if (insertError) {
      console.error(`[process-agent-replies] FAILED to insert ticket_message for job ${job.id}:`, insertError);
      throw new Error(`ticket_messages insert failed: ${insertError.message}`);
    }

    // Client-facing notification
    await db.from('notifications').insert({
      brand_id: job.brand_id,
      type:     'ticket_reply',
      message:  `Respuesta en tu ticket: "${reply.slice(0, 60)}${reply.length > 60 ? '…' : ''}"`,
      read:     false,
      metadata: { job_id: job.id, ticket_id: ticketId },
    }).then(() => null).catch(() => null);

    // If fully resolved, auto-advance ticket status to 'pending_client' so the worker dashboard
    // can tell the difference between "client waiting for reply" and "reply sent, waiting on client".
    if (payload.resolved === true && !needsHumanFollowUp) {
      await db.from('support_tickets')
        .update({ status: 'awaiting_client' })
        .eq('id', ticketId)
        .then(() => null)
        .catch(() => null);
    }

  } else if (source === 'chat') {
    const { error: insertError } = await db.from('chat_messages').insert({
      brand_id:    job.brand_id,
      sender_id:   null,
      sender_type: 'worker',
      message:     reply,
      attachments: [],
      metadata:    {
        job_id:              job.id,
        agent:               'support',
        category,
        solutions,
        needs_human_follow_up: needsHumanFollowUp,
      },
    });
    if (insertError) {
      console.error(`[process-agent-replies] FAILED to insert chat_message for job ${job.id}:`, insertError);
      throw new Error(`chat_messages insert failed: ${insertError.message}`);
    }

    await db.from('notifications').insert({
      brand_id: job.brand_id,
      type:     'chat_message',
      message:  `Nuevo mensaje del equipo de NeuroPost: "${reply.slice(0, 60)}${reply.length > 60 ? '…' : ''}"`,
      read:     false,
      metadata: { job_id: job.id },
    }).then(() => null).catch(() => null);

  } else {
    console.warn(`[process-agent-replies] Job ${job.id}: unknown support source '${source}'`);
    return;
  }

  // ── Worker follow-up ping ────────────────────────────────────────────────
  // When the agent couldn't fully resolve (billing disputes, unreproducible
  // bugs, feature requests, etc.), the reply still goes to the client so they
  // know they've been heard, but a worker gets pinged to follow up manually.
  if (needsHumanFollowUp) {
    const summary = escalationReason ?? `Categoría: ${category}`;
    await db.from('worker_notifications').insert({
      type:       'support_handover',
      message:    `Ticket requiere seguimiento humano: ${summary}`,
      brand_id:   job.brand_id,
      brand_name: null,
      read:       false,
      metadata: {
        job_id:    job.id,
        source,
        category,
        ticket_id: job.input?.ticket_id ?? null,
        reason:    escalationReason,
      },
    }).then(() => null).catch(() => null);
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

// ─── A/B test variant B handler ──────────────────────────────────────────────

async function processAbTestVariant(db: DB, job: AgentJob, output: AgentOutput) {
  const abTestId = job.input?._ab_test_id as string;
  if (!abTestId) return;

  const payload = output.payload as {
    copies?: Record<string, { caption?: string }>;
    hashtags?: { branded?: string[]; niche?: string[]; broad?: string[] };
  };

  // Extract caption from copywriter output
  const copies = payload.copies ?? {};
  const platform = Object.keys(copies)[0] ?? 'instagram';
  const caption = copies[platform]?.caption ?? '';
  const hashtags = [
    ...(payload.hashtags?.branded ?? []),
    ...(payload.hashtags?.niche ?? []),
    ...(payload.hashtags?.broad ?? []).slice(0, 3),
  ];

  if (!caption) return;

  await db.from('ab_tests').update({
    caption_b:  caption,
    hashtags_b: hashtags,
  }).eq('id', abTestId);

  console.log(`[process-agent-replies] A/B test ${abTestId}: variant B caption saved`);
}
