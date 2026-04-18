// =============================================================================
// NEUROPOST — Email via Resend
// Every gated email (non-transactional) must pass through canSendEmail() before
// dispatch and call markEmailSent() after a successful send. The footer with
// the unsubscribe link is appended automatically when brandId is provided.
// =============================================================================

import { Resend } from 'resend';
import { canSendEmail, markEmailSent, TRANSACTIONAL_TYPES, type EmailType } from './email/preferences';
import { buildEmailFooter, getPreferencesUrl } from './email/unsubscribe';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = () => process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
const APP  = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

// ─── Low-level send (no gating, used only by transactional callers) ─────────

async function sendRaw(to: string, subject: string, html: string): Promise<void> {
  await getResend().emails.send({ from: FROM(), to, subject, html });
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const BASE = `
  font-family: 'Inter', Arial, sans-serif;
  background: #fdf8f3;
  color: #1a1a1a;
  margin: 0; padding: 0;
`;

const CARD = `
  max-width: 560px;
  margin: 40px auto;
  background: #ffffff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
`;

const LOGO = `
  font-size: 24px;
  font-weight: 800;
  color: #ff6b35;
  text-decoration: none;
  letter-spacing: -0.5px;
`;

const BTN = `
  display: inline-block;
  background: #ff6b35;
  color: #ffffff;
  text-decoration: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
  margin-top: 16px;
`;

const MUTED = `font-size: 13px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;`;

/** Wrap body content with brand header + transactional footer (no unsubscribe). */
function layout(content: string): string {
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${content}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost · <a href="${getPreferencesUrl()}" style="color:#888">Gestionar notificaciones</a></p>
    </div>
  </body></html>`;
}

/** Wrap + append the per-type unsubscribe footer (gated emails). */
async function layoutWithUnsubscribe(
  content: string,
  brandId: string,
  type: EmailType | string,
): Promise<string> {
  const unsub = await buildEmailFooter(brandId, type);
  return `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${content}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost · <a href="${getPreferencesUrl()}" style="color:#888">Gestionar notificaciones</a></p>
      ${unsub}
    </div>
  </body></html>`;
}

// ─── Gated-send helper ──────────────────────────────────────────────────────

/**
 * Centralised gated send. Resolves the recipient, verifies preferences,
 * wraps the body with the unsubscribe footer and fires the email.
 * Returns `true` when sent, `false` when blocked.
 */
async function sendGated(params: {
  brandId:  string;
  type:     EmailType;
  subject:  string;
  body:     string;
  /** Optional explicit recipient override (e.g. invites to a different email). */
  to?:      string;
}): Promise<boolean> {
  const gate = await canSendEmail(params.brandId, params.type);
  if (!gate.allowed) {
    console.log(`[email] skip ${params.type} for brand ${params.brandId}: ${gate.reason}`);
    return false;
  }
  const recipient = params.to ?? gate.email;
  if (!recipient) {
    console.warn(`[email] no recipient for ${params.type} brand ${params.brandId}`);
    return false;
  }
  const html = await layoutWithUnsubscribe(params.body, params.brandId, params.type);
  await sendRaw(recipient, params.subject, html);
  await markEmailSent(params.brandId, params.type);
  return true;
}

// ─── 1. Welcome (transactional) ─────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const html = layout(`
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Bienvenido a NeuroPost, ${name || 'amigo/a'} 👋</h1>
    <p style="color:#555;line-height:1.6">Tu cuenta está lista. Ahora puedes crear contenido para redes sociales con IA en segundos.</p>
    <p style="font-weight:700;margin-top:24px;margin-bottom:8px">Primeros pasos:</p>
    <ol style="color:#555;line-height:2;padding-left:20px">
      <li>Configura tu marca en <strong>Ajustes</strong></li>
      <li>Conecta tu Instagram, Facebook o TikTok</li>
      <li>Genera tu primer post con IA</li>
    </ol>
    <a href="${APP()}/dashboard" style="${BTN}">Ir al dashboard →</a>
  `);
  await sendRaw(to, 'Bienvenido a NeuroPost 👋', html);
}

// ─── 2. Plan activated (transactional) ──────────────────────────────────────

export async function sendPlanActivatedEmail(to: string, plan: string, nextBillingDate: string): Promise<void> {
  const perks: Record<string, string[]> = {
    starter: ['12 posts al mes', 'Instagram y Facebook', 'Generación con IA'],
    pro:     ['Posts ilimitados', 'Publicación automática', '2 plataformas sociales', 'Análisis avanzado'],
    agency:  ['Todo lo de Pro', 'Hasta 10 marcas', 'Soporte prioritario', 'Gestor de equipo'],
  };
  const list = (perks[plan] ?? perks.starter).map((p) => `<li>${p}</li>`).join('');
  const html = layout(`
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Tu plan ${plan.charAt(0).toUpperCase() + plan.slice(1)} está activo ✅</h1>
    <p style="color:#555;line-height:1.6">Todo listo. Ya puedes aprovechar todas las ventajas de tu plan.</p>
    <ul style="color:#555;line-height:2;padding-left:20px">${list}</ul>
    <p style="color:#888;font-size:13px">Próximo cobro: ${nextBillingDate}</p>
    <a href="${APP()}/dashboard" style="${BTN}">Empezar a publicar →</a>
  `);
  await sendRaw(to, `Tu plan ${plan} está activo ✅`, html);
}

// ─── 3. Payment failed (gated: payment_failed) ──────────────────────────────

export async function sendPaymentFailedEmail(
  to:        string,
  portalUrl: string,
  brandId?:  string,
): Promise<void> {
  const body = `
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px;color:#e53e3e">⚠️ Problema con tu pago</h1>
    <p style="color:#555;line-height:1.6">No hemos podido cobrar tu suscripción de NeuroPost. Para no perder el acceso a tu plan, actualiza tu método de pago lo antes posible.</p>
    <p style="color:#888;font-size:13px">Tienes 3 días antes de que tu cuenta pase al plan gratuito.</p>
    <a href="${portalUrl}" style="${BTN};background:#e53e3e">Actualizar método de pago →</a>
  `;
  if (brandId) {
    await sendGated({ brandId, type: 'payment_failed', subject: '⚠️ Problema con tu pago en NeuroPost', body, to });
    return;
  }
  // No brandId — legacy call path (still need to notify; payment issues are critical)
  await sendRaw(to, '⚠️ Problema con tu pago en NeuroPost', layout(body));
}

// ─── 4. Post published (gated: post_published) ──────────────────────────────

export async function sendPostPublishedEmail(
  to:       string,
  postId:   string,
  platform: string,
  brandId?: string,
): Promise<void> {
  const body = `
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Tu post está publicado ✅</h1>
    <p style="color:#555;line-height:1.6">Tu contenido ya está visible en <strong>${platform}</strong>. En unas horas podrás ver las primeras métricas en tu panel de analíticas.</p>
    <a href="${APP()}/posts/${postId}" style="${BTN}">Ver post →</a>
  `;
  if (brandId) {
    await sendGated({ brandId, type: 'post_published', subject: `Tu post está en ${platform} ✅`, body, to });
    return;
  }
  await sendRaw(to, `Tu post está en ${platform} ✅`, layout(body));
}

// ─── 5. Weekly report (gated: weekly_report) ────────────────────────────────

export async function sendWeeklyReportEmail(
  to:        string,
  brandName: string,
  stats:     { posts: number; reach: number; engagement: string; topPost?: string },
  brandId?:  string,
): Promise<void> {
  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const subject = `Tu semana en redes · ${fmt(weekStart)} – ${fmt(now)}`;
  const body = `
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">${subject}</h1>
    <p style="color:#555">${brandName}</p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0">
      <tr style="background:#fdf8f3">
        <td style="padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.posts}</div>
          <div style="font-size:12px;color:#888;margin-top:4px">Posts publicados</div>
        </td>
        <td style="padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.reach.toLocaleString()}</div>
          <div style="font-size:12px;color:#888;margin-top:4px">Alcance total</div>
        </td>
        <td style="padding:12px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.engagement}</div>
          <div style="font-size:12px;color:#888;margin-top:4px">Engagement medio</div>
        </td>
      </tr>
    </table>
    ${stats.topPost ? `<p style="color:#555">🏆 Top post de la semana: <em>${stats.topPost}</em></p>` : ''}
    <a href="${APP()}/analytics" style="${BTN}">Ver analíticas completas →</a>
  `;
  if (brandId) {
    await sendGated({ brandId, type: 'weekly_report', subject, body, to });
    return;
  }
  await sendRaw(to, subject, layout(body));
}

// ─── 6. Reset password (transactional) ──────────────────────────────────────

export async function sendResetPasswordEmail(to: string, resetLink: string): Promise<void> {
  const html = layout(`
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Recupera tu contraseña</h1>
    <p style="color:#555;line-height:1.6">Hemos recibido una petición para restablecer la contraseña de tu cuenta de NeuroPost. Haz clic en el botón para crear una contraseña nueva.</p>
    <p style="color:#888;font-size:13px">Este enlace caduca en 1 hora. Si no solicitaste el cambio, ignora este email.</p>
    <a href="${resetLink}" style="${BTN}">Restablecer contraseña →</a>
  `);
  await sendRaw(to, 'Recupera tu contraseña de NeuroPost', html);
}

// ─── 7. Team invite (transactional) ─────────────────────────────────────────

export async function sendTeamInviteEmail(
  to:          string,
  inviterName: string,
  brandName:   string,
  role:        string,
  inviteUrl:   string,
): Promise<void> {
  const html = layout(`
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Te han invitado a NeuroPost 🎉</h1>
    <p style="color:#555;line-height:1.6"><strong>${inviterName}</strong> te ha invitado a gestionar <strong>${brandName}</strong> como <em>${role}</em>.</p>
    <p style="color:#555;line-height:1.6">Acepta la invitación para empezar a colaborar en la creación de contenido con IA.</p>
    <a href="${inviteUrl}" style="${BTN}">Aceptar invitación →</a>
    <p style="color:#888;font-size:13px;margin-top:16px">Esta invitación caduca en 7 días.</p>
  `);
  await sendRaw(to, `${inviterName} te ha invitado a gestionar ${brandName}`, html);
}

// ─── 8. Urgent support ticket (transactional, internal) ─────────────────────

export async function sendUrgentTicketEmail(opts: {
  to:          string;
  brandName:   string;
  subject:     string;
  description: string;
  category:    string;
  ticketId:    string;
  clientEmail: string;
}): Promise<void> {
  const html = layout(`
    <h1 style="font-size:22px;font-weight:800;margin:24px 0 8px;color:#e53e3e">🚨 Ticket urgente — acción requerida</h1>
    <p style="color:#555;line-height:1.6">
      Un cliente ha abierto un ticket marcado como <strong>urgente</strong> y requiere tu atención directa.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px">
      <tr style="background:#fdf8f3">
        <td style="padding:10px 14px;font-weight:700;width:120px;border-bottom:1px solid #eee">Cliente</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee">${opts.brandName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Email</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee"><a href="mailto:${opts.clientEmail}" style="color:#ff6b35">${opts.clientEmail}</a></td>
      </tr>
      <tr style="background:#fdf8f3">
        <td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Categoría</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-transform:capitalize">${opts.category}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-weight:700">Asunto</td>
        <td style="padding:10px 14px">${opts.subject}</td>
      </tr>
    </table>
    ${opts.description ? `
    <div style="background:#fdf8f3;border-left:3px solid #e53e3e;padding:14px 16px;margin:16px 0;border-radius:0 6px 6px 0">
      <p style="font-size:13px;color:#333;line-height:1.7;margin:0">${opts.description.replace(/\n/g, '<br>')}</p>
    </div>` : ''}
    <a href="${APP()}/worker/inbox?ticket=${opts.ticketId}" style="${BTN};background:#e53e3e">
      Ver ticket en el panel →
    </a>
  `);
  await sendRaw(opts.to, `🚨 Ticket urgente: ${opts.subject} — ${opts.brandName}`, html);
}

// ─── 9. Subscription cancelled (transactional) ──────────────────────────────

export async function sendSubscriptionCancelledEmail(to: string): Promise<void> {
  const html = layout(`
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">Tu suscripción ha finalizado</h1>
    <p style="color:#555;line-height:1.6">Tu plan de NeuroPost ha sido cancelado. Tu cuenta ha pasado al plan gratuito.</p>
    <p style="color:#555;line-height:1.6">Siempre puedes volver a activar un plan cuando quieras.</p>
    <a href="${APP()}/settings/plan" style="${BTN}">Volver a activar →</a>
  `);
  await sendRaw(to, 'Tu suscripción de NeuroPost ha finalizado', html);
}

// ─── 10. Generic notification email (gated, called from notify.ts) ──────────

const NOTIF_TITLES: Record<string, string> = {
  approval_needed:  'Tu contenido está listo',
  published:        'Post publicado',
  failed:           'Error en la generación',
  comment:          'Nuevo comentario en tu post',
  ticket_reply:     'Respuesta en tu ticket',
  chat_message:     'Nuevo mensaje del equipo de NeuroPost',
  recreation_ready: 'Tu recreación está lista',
  limit_reached:    'Has alcanzado el límite de tu plan',
  token_expired:    'Reconecta tu cuenta de Instagram',
  payment_failed:   'Error en el pago',
  plan_activated:   'Plan activado',
};

const NOTIF_CTA: Record<string, { label: string; path: string }> = {
  approval_needed:  { label: 'Ver contenido',        path: '/posts' },
  published:        { label: 'Ver post publicado',    path: '/posts' },
  comment:          { label: 'Ver comentarios',       path: '/comments' },
  ticket_reply:     { label: 'Ver ticket',            path: '/soporte' },
  chat_message:     { label: 'Ir al chat',            path: '/chat' },
  recreation_ready: { label: 'Ver recreación',        path: '/inspiracion' },
  limit_reached:    { label: 'Mejorar plan',          path: '/settings/plan' },
  token_expired:    { label: 'Reconectar',            path: '/settings/connections' },
  payment_failed:   { label: 'Actualizar pago',       path: '/settings/plan' },
  plan_activated:   { label: 'Ir al dashboard',       path: '/dashboard' },
};

// Maps notification type → gated EmailType (skip when not mapped).
const NOTIF_EMAIL_TYPE: Record<string, EmailType> = {
  approval_needed:  'approval_needed',
  published:        'post_published',
  failed:           'post_failed',
  comment:          'comment_pending',
  ticket_reply:     'ticket_reply',
  chat_message:     'chat_message',
  recreation_ready: 'recreation_ready',
  limit_reached:    'limit_reached',
  token_expired:    'token_expired',
  payment_failed:   'payment_failed',
};

export async function sendNotificationEmail(opts: {
  to:        string;
  brandName: string;
  type:      string;
  message:   string;
  metadata?: Record<string, unknown>;
  brandId?:  string;
}): Promise<void> {
  const title   = NOTIF_TITLES[opts.type] ?? 'Notificación de NeuroPost';
  const cta     = NOTIF_CTA[opts.type];
  const ctaHtml = cta
    ? `<a href="${APP()}${cta.path}" style="${BTN}">${cta.label} →</a>`
    : `<a href="${APP()}/dashboard" style="${BTN}">Ir a NeuroPost →</a>`;

  const body = `
    <h1 style="font-size:26px;font-weight:800;margin:24px 0 8px">${title}</h1>
    <p style="color:#555;line-height:1.6">${opts.message}</p>
    ${ctaHtml}
    <p style="color:#999;font-size:12px;margin-top:24px;line-height:1.5">
      Puedes configurar qué notificaciones recibes por email en
      <a href="${getPreferencesUrl()}" style="color:#ff6b35">Ajustes → Notificaciones</a>.
    </p>
  `;

  const subject = `${title} — ${opts.brandName}`;
  const emailType = NOTIF_EMAIL_TYPE[opts.type];

  // Gated path: we have a brandId and a known mapping
  if (opts.brandId && emailType && !TRANSACTIONAL_TYPES.has(opts.type)) {
    await sendGated({ brandId: opts.brandId, type: emailType, subject, body, to: opts.to });
    return;
  }

  // Fallback — transactional layout, no unsubscribe
  await sendRaw(opts.to, subject, layout(body));
}

// ─── Re-exports for callers that want the preference helpers ────────────────

export { canSendEmail, markEmailSent, TRANSACTIONAL_TYPES } from './email/preferences';
export type { EmailType } from './email/preferences';
