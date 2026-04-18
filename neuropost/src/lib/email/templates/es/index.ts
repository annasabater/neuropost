// =============================================================================
// NEUROPOST — Spanish email templates (default locale)
// =============================================================================

import {
  APP_URL, STYLE, type EmailTemplates, type TemplateOutput,
} from '../shared';

// ─── Generic-notification copy (title + CTA per in-app notif type) ─────────

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

// ─── Templates ──────────────────────────────────────────────────────────────

export const templates: EmailTemplates = {
  welcome: ({ name }): TemplateOutput => ({
    subject: 'Bienvenido a NeuroPost 👋',
    preview: 'Tu cuenta está lista. Primeros pasos dentro.',
    html: `
      <h1 style="${STYLE.h1}">Bienvenido a NeuroPost, ${name || 'amigo/a'} 👋</h1>
      <p style="${STYLE.p}">Tu cuenta está lista. Ahora puedes crear contenido para redes sociales con IA en segundos.</p>
      <p style="font-weight:700;margin-top:24px;margin-bottom:8px">Primeros pasos:</p>
      <ol style="color:#555;line-height:2;padding-left:20px">
        <li>Configura tu marca en <strong>Ajustes</strong></li>
        <li>Conecta tu Instagram, Facebook o TikTok</li>
        <li>Genera tu primer post con IA</li>
      </ol>
      <a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Ir al dashboard →</a>
    `,
  }),

  planActivated: ({ plan, nextBillingDate }): TemplateOutput => {
    const perks: Record<string, string[]> = {
      starter: ['12 posts al mes', 'Instagram y Facebook', 'Generación con IA'],
      pro:     ['Posts ilimitados', 'Publicación automática', '2 plataformas sociales', 'Análisis avanzado'],
      agency:  ['Todo lo de Pro', 'Hasta 10 marcas', 'Soporte prioritario', 'Gestor de equipo'],
    };
    const list = (perks[plan] ?? perks.starter).map(p => `<li>${p}</li>`).join('');
    return {
      subject: `Tu plan ${plan} está activo ✅`,
      preview: 'Todo listo. Empieza a aprovechar tu plan.',
      html: `
        <h1 style="${STYLE.h1}">Tu plan ${plan.charAt(0).toUpperCase() + plan.slice(1)} está activo ✅</h1>
        <p style="${STYLE.p}">Todo listo. Ya puedes aprovechar todas las ventajas de tu plan.</p>
        <ul style="color:#555;line-height:2;padding-left:20px">${list}</ul>
        <p style="${STYLE.small}">Próximo cobro: ${nextBillingDate}</p>
        <a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Empezar a publicar →</a>
      `,
    };
  },

  paymentFailed: ({ portalUrl }): TemplateOutput => ({
    subject: '⚠️ Problema con tu pago en NeuroPost',
    preview: 'No pudimos cobrar tu suscripción. Actualiza el método de pago.',
    html: `
      <h1 style="${STYLE.h1Danger}">⚠️ Problema con tu pago</h1>
      <p style="${STYLE.p}">No hemos podido cobrar tu suscripción de NeuroPost. Para no perder el acceso a tu plan, actualiza tu método de pago lo antes posible.</p>
      <p style="${STYLE.small}">Tienes 3 días antes de que tu cuenta pase al plan gratuito.</p>
      <a href="${portalUrl}" style="${STYLE.btnDanger}">Actualizar método de pago →</a>
    `,
  }),

  postPublished: ({ postId, platform }): TemplateOutput => ({
    subject: `Tu post está en ${platform} ✅`,
    preview: `Tu contenido ya está visible en ${platform}.`,
    html: `
      <h1 style="${STYLE.h1}">Tu post está publicado ✅</h1>
      <p style="${STYLE.p}">Tu contenido ya está visible en <strong>${platform}</strong>. En unas horas podrás ver las primeras métricas en tu panel de analíticas.</p>
      <a href="${APP_URL()}/posts/${postId}" style="${STYLE.btn}">Ver post →</a>
    `,
  }),

  weeklyReport: ({ brandName, stats }): TemplateOutput => {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const subject = `Tu semana en redes · ${fmt(weekStart)} – ${fmt(now)}`;
    return {
      subject,
      preview: `${stats.posts} posts · ${stats.reach.toLocaleString()} alcance · ${stats.engagement} engagement`,
      html: `
        <h1 style="${STYLE.h1}">${subject}</h1>
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
        <a href="${APP_URL()}/analytics" style="${STYLE.btn}">Ver analíticas completas →</a>
      `,
    };
  },

  resetPassword: ({ resetLink }): TemplateOutput => ({
    subject: 'Recupera tu contraseña de NeuroPost',
    preview: 'Enlace para restablecer tu contraseña.',
    html: `
      <h1 style="${STYLE.h1}">Recupera tu contraseña</h1>
      <p style="${STYLE.p}">Hemos recibido una petición para restablecer la contraseña de tu cuenta de NeuroPost. Haz clic en el botón para crear una contraseña nueva.</p>
      <p style="${STYLE.small}">Este enlace caduca en 1 hora. Si no solicitaste el cambio, ignora este email.</p>
      <a href="${resetLink}" style="${STYLE.btn}">Restablecer contraseña →</a>
    `,
  }),

  teamInvite: ({ inviterName, brandName, role, inviteUrl }): TemplateOutput => ({
    subject: `${inviterName} te ha invitado a gestionar ${brandName}`,
    preview: `Invitación como ${role}.`,
    html: `
      <h1 style="${STYLE.h1}">Te han invitado a NeuroPost 🎉</h1>
      <p style="${STYLE.p}"><strong>${inviterName}</strong> te ha invitado a gestionar <strong>${brandName}</strong> como <em>${role}</em>.</p>
      <p style="${STYLE.p}">Acepta la invitación para empezar a colaborar en la creación de contenido con IA.</p>
      <a href="${inviteUrl}" style="${STYLE.btn}">Aceptar invitación →</a>
      <p style="${STYLE.small};margin-top:16px">Esta invitación caduca en 7 días.</p>
    `,
  }),

  urgentTicket: ({ brandName, subject, description, category, ticketId, clientEmail }): TemplateOutput => ({
    subject: `🚨 Ticket urgente: ${subject} — ${brandName}`,
    preview: `Ticket urgente de ${brandName} requiere atención.`,
    html: `
      <h1 style="font-size:22px;font-weight:800;margin:24px 0 8px;color:#e53e3e">🚨 Ticket urgente — acción requerida</h1>
      <p style="${STYLE.p}">Un cliente ha abierto un ticket marcado como <strong>urgente</strong> y requiere tu atención directa.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px">
        <tr style="background:#fdf8f3"><td style="padding:10px 14px;font-weight:700;width:120px;border-bottom:1px solid #eee">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #eee">${brandName}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Email</td><td style="padding:10px 14px;border-bottom:1px solid #eee"><a href="mailto:${clientEmail}" style="color:#ff6b35">${clientEmail}</a></td></tr>
        <tr style="background:#fdf8f3"><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Categoría</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-transform:capitalize">${category}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:700">Asunto</td><td style="padding:10px 14px">${subject}</td></tr>
      </table>
      ${description ? `<div style="background:#fdf8f3;border-left:3px solid #e53e3e;padding:14px 16px;margin:16px 0;border-radius:0 6px 6px 0"><p style="font-size:13px;color:#333;line-height:1.7;margin:0">${description.replace(/\n/g, '<br>')}</p></div>` : ''}
      <a href="${APP_URL()}/worker/inbox?ticket=${ticketId}" style="${STYLE.btnDanger}">Ver ticket en el panel →</a>
    `,
  }),

  subscriptionCancelled: (): TemplateOutput => ({
    subject: 'Tu suscripción de NeuroPost ha finalizado',
    preview: 'Tu plan ha pasado al gratuito. Puedes reactivar cuando quieras.',
    html: `
      <h1 style="${STYLE.h1}">Tu suscripción ha finalizado</h1>
      <p style="${STYLE.p}">Tu plan de NeuroPost ha sido cancelado. Tu cuenta ha pasado al plan gratuito.</p>
      <p style="${STYLE.p}">Siempre puedes volver a activar un plan cuando quieras.</p>
      <a href="${APP_URL()}/settings/plan" style="${STYLE.btn}">Volver a activar →</a>
    `,
  }),

  reactivation: ({ brandName, segment, isPaid }): TemplateOutput => {
    const appUrl = APP_URL();

    if (segment === 7) {
      return {
        subject: 'Te echamos de menos en NeuroPost',
        preview: 'Hace una semana que no te vemos por el dashboard.',
        html: `
          <h1 style="${STYLE.h1}">Hola de nuevo, ${brandName} 👋</h1>
          <p style="${STYLE.p}">
            Han pasado 7 días desde tu última visita. Tu marca sigue aquí,
            tus borradores te esperan y los agentes de IA están listos para
            seguir creando contenido cuando tú quieras.
          </p>
          <p style="${STYLE.p}">
            ¿Una foto rápida, un reel, un carrusel? En dos minutos lo tienes.
          </p>
          <a href="${appUrl}/dashboard" style="${STYLE.btn}">Volver al dashboard →</a>
        `,
      };
    }

    if (segment === 14) {
      return {
        subject: '¿Todo bien por ahí?',
        preview: 'Han pasado dos semanas — cuéntanos qué necesitas.',
        html: `
          <h1 style="${STYLE.h1}">¿Todo bien por ahí?</h1>
          <p style="${STYLE.p}">
            Llevas dos semanas sin entrar a NeuroPost y queremos asegurarnos
            de que no hay nada bloqueándote.
          </p>
          <p style="${STYLE.p}">
            Si te falta una función, si algo no funciona, o si simplemente
            necesitas una mano, cuéntanoslo. Leemos todo lo que nos llega.
          </p>
          <a href="${appUrl}/dashboard" style="${STYLE.btn}">Ir al dashboard</a>
          <p style="margin-top:14px">
            <a href="${appUrl}/soporte" style="color:#ff6b35;text-decoration:underline;font-size:14px">
              …o abre un ticket y te contestamos →
            </a>
          </p>
        `,
      };
    }

    // 30 days (or anything higher — same copy)
    const paidLine = isPaid
      ? `<p style="${STYLE.p}">Tu plan sigue activo y se renueva cada mes. Si ya no te compensa, también puedes cancelarlo ahora mismo sin líos — nos parece más honesto avisarte que dejarte pagando sin usar.</p>`
      : '';
    return {
      subject: 'Tu cuenta de NeuroPost está esperándote',
      preview: 'Un mes sin vernos. ¿Retomamos?',
      html: `
        <h1 style="${STYLE.h1}">Tu cuenta te está esperando</h1>
        <p style="${STYLE.p}">
          Ha pasado un mes desde tu última visita. Tu marca, tu biblioteca
          y tus conexiones siguen intactas — solo tienes que volver cuando
          te venga bien.
        </p>
        <p style="${STYLE.p}">
          Te proponemos algo: entra 10 minutos, deja un post programado
          para esta semana y te olvidas. Lo hacemos nosotros por ti.
        </p>
        ${paidLine}
        <a href="${appUrl}/dashboard" style="${STYLE.btn}">Volver a NeuroPost →</a>
        ${isPaid
          ? `<p style="margin-top:14px">
              <a href="${appUrl}/settings/plan" style="color:#888;text-decoration:underline;font-size:13px">
                Cancelar suscripción
              </a>
            </p>`
          : ''}
      `,
    };
  },

  genericNotification: ({ brandName, type, message }): TemplateOutput => {
    const title   = NOTIF_TITLES[type] ?? 'Notificación de NeuroPost';
    const cta     = NOTIF_CTA[type];
    const ctaHtml = cta
      ? `<a href="${APP_URL()}${cta.path}" style="${STYLE.btn}">${cta.label} →</a>`
      : `<a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Ir a NeuroPost →</a>`;
    return {
      subject: `${title} — ${brandName}`,
      preview: message.slice(0, 100),
      html: `
        <h1 style="${STYLE.h1}">${title}</h1>
        <p style="${STYLE.p}">${message}</p>
        ${ctaHtml}
      `,
    };
  },
};
