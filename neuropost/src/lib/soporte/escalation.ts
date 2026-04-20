// =============================================================================
// Escalation handler — inserts incident + sends email via Resend
// =============================================================================
// Called from process-agent-replies cron when CommunityAgent returns
// decision === 'escalate'. No Edge Functions needed — runs in Vercel.

import { createAdminClient } from '@/lib/supabase';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const TEAM_EMAIL = 'neuropost.team@gmail.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'NeuroPost Soporte <onboarding@resend.dev>';

interface EscalationParams {
  brandId: string;
  jobId: string;
  userId?: string;
  source: string;
  mensajeOriginal: string;
  respuestaAgente: string;
  category: string;
  sentiment: string;
  nivelEscalada?: 2 | 3;
}

export async function handleEscalation(params: EscalationParams): Promise<void> {
  const db = createAdminClient();
  const nivel = params.nivelEscalada ?? 2;

  // 1. Insert into incidencias_soporte
  const { error: insertError } = await db.from('incidencias_soporte').insert({
    brand_id: params.brandId,
    job_id: params.jobId,
    usuario_id: params.userId ?? 'unknown',
    nivel_escalada: nivel,
    motivo: `${params.category} — ${params.sentiment} (${params.source})`,
    mensaje_original: params.mensajeOriginal,
    respuesta_agente: params.respuestaAgente,
    source: params.source,
    accion_tomada: nivel === 3 ? 'cerrada' : 'derivada',
    email_enviado: false,
  });

  if (insertError) {
    console.error('[escalation] Failed to insert incidencia:', insertError);
  }

  // 2. Send email via Resend (best-effort)
  if (!RESEND_API_KEY) {
    console.warn('[escalation] RESEND_API_KEY not set, skipping email');
    return;
  }

  try {
    const nivelTexto = nivel === 2
      ? 'NIVEL 2 — Conversacion derivada'
      : 'NIVEL 3 — Conversacion cerrada';

    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;">
          <h2 style="margin:0;">Alerta de soporte — NeuroPost</h2>
        </div>
        <div style="padding:20px;border:1px solid #e0e0e0;">
          <p style="font-size:16px;font-weight:600;color:#E24B4A;">${nivelTexto}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Brand</td><td style="padding:6px 0;font-weight:500;">${params.brandId}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Source</td><td style="padding:6px 0;">${params.source}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Category</td><td style="padding:6px 0;">${params.category}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Sentiment</td><td style="padding:6px 0;">${params.sentiment}</td></tr>
          </table>
          <h3>Mensaje del cliente</h3>
          <div style="padding:8px 12px;border-left:3px solid #E24B4A;background:#f9f9f9;">
            ${params.mensajeOriginal}
          </div>
          <h3>Respuesta del agente</h3>
          <div style="padding:8px 12px;border-left:3px solid #1D9E75;background:#f9f9f9;">
            ${params.respuestaAgente}
          </div>
          <p style="margin-top:20px;font-size:13px;color:#999;">
            Job ID: ${params.jobId}
          </p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TEAM_EMAIL],
        subject: `[ALERTA SOPORTE] ${nivelTexto} — ${params.source}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[escalation] Resend API error:', err);
    } else {
      // Mark email as sent
      await db.from('incidencias_soporte')
        .update({ email_enviado: true })
        .eq('job_id', params.jobId);
      console.log(`[escalation] Email sent for job ${params.jobId}`);
    }
  } catch (err) {
    console.error('[escalation] Email send failed:', err);
  }
}
