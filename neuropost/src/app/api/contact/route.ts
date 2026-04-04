import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/ratelimit';

const FROM  = () => process.env.RESEND_FROM_EMAIL  ?? 'noreply@neuropost.app';
const ADMIN = () => process.env.ADMIN_EMAIL         ?? 'hola@neuropost.es';
const APP   = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

const BASE = `font-family:'Inter',Arial,sans-serif;background:#fdf8f3;color:#1a1a1a;margin:0;padding:0;`;
const CARD = `max-width:560px;margin:40px auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);`;
const LOGO = `font-size:24px;font-weight:800;color:#ff6b35;text-decoration:none;letter-spacing:-0.5px;`;
const BTN  = `display:inline-block;background:#ff6b35;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:16px;`;
const MUTED = `font-size:13px;color:#888;margin-top:32px;border-top:1px solid #eee;padding-top:16px;`;

function layout(content: string) {
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${content}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost</p>
    </div>
  </body></html>`;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // silently skip in dev without key
  const { Resend } = await import('resend');
  await new Resend(key).emails.send({ from: FROM(), to, subject, html });
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp    = request.headers.get('x-real-ip');
    const ip        = (forwarded ? forwarded.split(',')[0].trim() : realIp) ?? '127.0.0.1';

    const rateLimit = checkRateLimit(`contact:${ip}`, 3, 60 * 60 * 1000); // 3 per hour
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Por favor, espera antes de volver a intentarlo.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, email, business_type, subject, message, privacy } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }
    if (!privacy) {
      return NextResponse.json({ error: 'Debes aceptar la política de privacidad' }, { status: 400 });
    }

    const db = createAdminClient();
    const { error: dbError } = await db.from('contact_requests').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      business_type: business_type ?? null,
      subject: subject ?? null,
      message: message.trim(),
      status: 'pending',
    });
    if (dbError) throw dbError;

    // Admin notification
    const adminHtml = layout(`
      <h2 style="font-size:20px;font-weight:800;margin:24px 0 8px">Nuevo mensaje de contacto</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#888;width:140px">Nombre</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0">${email}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Tipo negocio</td><td style="padding:8px 0">${business_type ?? '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Asunto</td><td style="padding:8px 0">${subject ?? '—'}</td></tr>
      </table>
      <div style="background:#f5f0e8;border-radius:10px;padding:16px;font-size:14px;line-height:1.6;margin:16px 0">${message.replace(/\n/g, '<br>')}</div>
      <a href="${APP()}/admin/contactos" style="${BTN}">Ver en panel admin →</a>
    `);
    await sendViaResend(ADMIN(), `Nuevo mensaje de contacto — ${name}`, adminHtml);

    // User confirmation
    const userHtml = layout(`
      <h2 style="font-size:22px;font-weight:800;margin:24px 0 8px">Hemos recibido tu mensaje, ${name.split(' ')[0]} ✅</h2>
      <p style="color:#555;line-height:1.6">Gracias por escribirnos. Te respondemos en menos de 24 horas en días laborables.</p>
      <p style="color:#555;line-height:1.6">Si tienes alguna urgencia, puedes escribirnos directamente a <a href="mailto:hola@neuropost.es" style="color:#ff6b35">hola@neuropost.es</a>.</p>
      <a href="${APP()}" style="${BTN}">Volver a NeuroPost →</a>
    `);
    await sendViaResend(email.trim(), `Hemos recibido tu mensaje, ${name.split(' ')[0]}`, userHtml);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
