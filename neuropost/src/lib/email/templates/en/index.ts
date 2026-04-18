// =============================================================================
// NEUROPOST — English email templates
// =============================================================================

import {
  APP_URL, STYLE, type EmailTemplates, type TemplateOutput,
} from '../shared';

const NOTIF_TITLES: Record<string, string> = {
  approval_needed:  'Your content is ready',
  published:        'Post published',
  failed:           'Generation failed',
  comment:          'New comment on your post',
  ticket_reply:     'Reply on your ticket',
  chat_message:     'New message from the NeuroPost team',
  recreation_ready: 'Your recreation is ready',
  limit_reached:    'You have reached your plan limit',
  token_expired:    'Reconnect your Instagram account',
  payment_failed:   'Payment failed',
  plan_activated:   'Plan activated',
};
const NOTIF_CTA: Record<string, { label: string; path: string }> = {
  approval_needed:  { label: 'View content',        path: '/posts' },
  published:        { label: 'View published post', path: '/posts' },
  comment:          { label: 'View comments',       path: '/comments' },
  ticket_reply:     { label: 'View ticket',         path: '/soporte' },
  chat_message:     { label: 'Go to chat',          path: '/chat' },
  recreation_ready: { label: 'View recreation',     path: '/inspiracion' },
  limit_reached:    { label: 'Upgrade plan',        path: '/settings/plan' },
  token_expired:    { label: 'Reconnect',           path: '/settings/connections' },
  payment_failed:   { label: 'Update payment',      path: '/settings/plan' },
  plan_activated:   { label: 'Go to dashboard',     path: '/dashboard' },
};

export const templates: EmailTemplates = {
  welcome: ({ name }): TemplateOutput => ({
    subject: 'Welcome to NeuroPost 👋',
    preview: 'Your account is ready. First steps inside.',
    html: `
      <h1 style="${STYLE.h1}">Welcome to NeuroPost, ${name || 'friend'} 👋</h1>
      <p style="${STYLE.p}">Your account is ready. You can now create social-media content with AI in seconds.</p>
      <p style="font-weight:700;margin-top:24px;margin-bottom:8px">First steps:</p>
      <ol style="color:#555;line-height:2;padding-left:20px">
        <li>Set up your brand in <strong>Settings</strong></li>
        <li>Connect your Instagram, Facebook or TikTok</li>
        <li>Generate your first AI post</li>
      </ol>
      <a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Go to dashboard →</a>
    `,
  }),

  planActivated: ({ plan, nextBillingDate }): TemplateOutput => {
    const perks: Record<string, string[]> = {
      starter: ['12 posts per month', 'Instagram and Facebook', 'AI generation'],
      pro:     ['Unlimited posts', 'Auto-publishing', '2 social platforms', 'Advanced analytics'],
      agency:  ['Everything in Pro', 'Up to 10 brands', 'Priority support', 'Team manager'],
    };
    const list = (perks[plan] ?? perks.starter).map(p => `<li>${p}</li>`).join('');
    return {
      subject: `Your ${plan} plan is active ✅`,
      preview: 'All set. Start enjoying your plan.',
      html: `
        <h1 style="${STYLE.h1}">Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is active ✅</h1>
        <p style="${STYLE.p}">All set. You can now enjoy every perk of your plan.</p>
        <ul style="color:#555;line-height:2;padding-left:20px">${list}</ul>
        <p style="${STYLE.small}">Next billing date: ${nextBillingDate}</p>
        <a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Start publishing →</a>
      `,
    };
  },

  paymentFailed: ({ portalUrl }): TemplateOutput => ({
    subject: '⚠️ Payment issue on NeuroPost',
    preview: 'We could not charge your subscription. Update your payment method.',
    html: `
      <h1 style="${STYLE.h1Danger}">⚠️ Problem with your payment</h1>
      <p style="${STYLE.p}">We could not charge your NeuroPost subscription. To keep your plan, please update your payment method as soon as possible.</p>
      <p style="${STYLE.small}">You have 3 days before your account falls back to the free plan.</p>
      <a href="${portalUrl}" style="${STYLE.btnDanger}">Update payment method →</a>
    `,
  }),

  postPublished: ({ postId, platform }): TemplateOutput => ({
    subject: `Your post is live on ${platform} ✅`,
    preview: `Your content is now visible on ${platform}.`,
    html: `
      <h1 style="${STYLE.h1}">Your post is published ✅</h1>
      <p style="${STYLE.p}">Your content is now visible on <strong>${platform}</strong>. In a few hours you'll see the first metrics in your analytics panel.</p>
      <a href="${APP_URL()}/posts/${postId}" style="${STYLE.btn}">View post →</a>
    `,
  }),

  weeklyReport: ({ brandName, stats }): TemplateOutput => {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const subject = `Your week on socials · ${fmt(weekStart)} – ${fmt(now)}`;
    return {
      subject,
      preview: `${stats.posts} posts · ${stats.reach.toLocaleString()} reach · ${stats.engagement} engagement`,
      html: `
        <h1 style="${STYLE.h1}">${subject}</h1>
        <p style="color:#555">${brandName}</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr style="background:#fdf8f3">
            <td style="padding:12px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.posts}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">Posts published</div>
            </td>
            <td style="padding:12px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.reach.toLocaleString()}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">Total reach</div>
            </td>
            <td style="padding:12px;border-radius:8px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:#ff6b35">${stats.engagement}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">Avg. engagement</div>
            </td>
          </tr>
        </table>
        ${stats.topPost ? `<p style="color:#555">🏆 Top post of the week: <em>${stats.topPost}</em></p>` : ''}
        <a href="${APP_URL()}/analytics" style="${STYLE.btn}">See full analytics →</a>
      `,
    };
  },

  resetPassword: ({ resetLink }): TemplateOutput => ({
    subject: 'Reset your NeuroPost password',
    preview: 'Link to reset your password.',
    html: `
      <h1 style="${STYLE.h1}">Reset your password</h1>
      <p style="${STYLE.p}">We received a request to reset the password of your NeuroPost account. Click the button to create a new password.</p>
      <p style="${STYLE.small}">This link expires in 1 hour. If you didn't request the change, ignore this email.</p>
      <a href="${resetLink}" style="${STYLE.btn}">Reset password →</a>
    `,
  }),

  teamInvite: ({ inviterName, brandName, role, inviteUrl }): TemplateOutput => ({
    subject: `${inviterName} invited you to manage ${brandName}`,
    preview: `Invitation as ${role}.`,
    html: `
      <h1 style="${STYLE.h1}">You've been invited to NeuroPost 🎉</h1>
      <p style="${STYLE.p}"><strong>${inviterName}</strong> has invited you to manage <strong>${brandName}</strong> as <em>${role}</em>.</p>
      <p style="${STYLE.p}">Accept the invitation to start collaborating on AI content creation.</p>
      <a href="${inviteUrl}" style="${STYLE.btn}">Accept invitation →</a>
      <p style="${STYLE.small};margin-top:16px">This invitation expires in 7 days.</p>
    `,
  }),

  urgentTicket: ({ brandName, subject, description, category, ticketId, clientEmail }): TemplateOutput => ({
    subject: `🚨 Urgent ticket: ${subject} — ${brandName}`,
    preview: `Urgent ticket from ${brandName} needs attention.`,
    html: `
      <h1 style="font-size:22px;font-weight:800;margin:24px 0 8px;color:#e53e3e">🚨 Urgent ticket — action required</h1>
      <p style="${STYLE.p}">A client has opened a ticket marked as <strong>urgent</strong> and needs your direct attention.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px">
        <tr style="background:#fdf8f3"><td style="padding:10px 14px;font-weight:700;width:120px;border-bottom:1px solid #eee">Client</td><td style="padding:10px 14px;border-bottom:1px solid #eee">${brandName}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Email</td><td style="padding:10px 14px;border-bottom:1px solid #eee"><a href="mailto:${clientEmail}" style="color:#ff6b35">${clientEmail}</a></td></tr>
        <tr style="background:#fdf8f3"><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #eee">Category</td><td style="padding:10px 14px;border-bottom:1px solid #eee;text-transform:capitalize">${category}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:700">Subject</td><td style="padding:10px 14px">${subject}</td></tr>
      </table>
      ${description ? `<div style="background:#fdf8f3;border-left:3px solid #e53e3e;padding:14px 16px;margin:16px 0;border-radius:0 6px 6px 0"><p style="font-size:13px;color:#333;line-height:1.7;margin:0">${description.replace(/\n/g, '<br>')}</p></div>` : ''}
      <a href="${APP_URL()}/worker/inbox?ticket=${ticketId}" style="${STYLE.btnDanger}">Open ticket in panel →</a>
    `,
  }),

  subscriptionCancelled: (): TemplateOutput => ({
    subject: 'Your NeuroPost subscription has ended',
    preview: 'Your plan is back to free. You can reactivate anytime.',
    html: `
      <h1 style="${STYLE.h1}">Your subscription has ended</h1>
      <p style="${STYLE.p}">Your NeuroPost plan has been cancelled. Your account is back to the free plan.</p>
      <p style="${STYLE.p}">You can reactivate a plan whenever you want.</p>
      <a href="${APP_URL()}/settings/plan" style="${STYLE.btn}">Reactivate →</a>
    `,
  }),

  reactivation: ({ brandName, segment, isPaid }): TemplateOutput => {
    const appUrl = APP_URL();

    if (segment === 7) {
      return {
        subject: 'We miss you at NeuroPost',
        preview: 'It has been a week since we last saw you in the dashboard.',
        html: `
          <h1 style="${STYLE.h1}">Hi again, ${brandName} 👋</h1>
          <p style="${STYLE.p}">
            It has been 7 days since your last visit. Your brand is still here,
            your drafts are waiting, and the AI agents are ready to keep
            creating content whenever you are.
          </p>
          <p style="${STYLE.p}">
            A quick photo, a reel, a carousel? You can ship something in two minutes.
          </p>
          <a href="${appUrl}/dashboard" style="${STYLE.btn}">Back to dashboard →</a>
        `,
      };
    }

    if (segment === 14) {
      return {
        subject: 'Everything OK over there?',
        preview: 'Two weeks without seeing you — tell us what you need.',
        html: `
          <h1 style="${STYLE.h1}">Everything OK over there?</h1>
          <p style="${STYLE.p}">
            It has been two weeks since you last logged in to NeuroPost and we
            want to make sure nothing is blocking you.
          </p>
          <p style="${STYLE.p}">
            If a feature is missing, something is broken, or you just need a
            hand — tell us. We read every message.
          </p>
          <a href="${appUrl}/dashboard" style="${STYLE.btn}">Go to dashboard</a>
          <p style="margin-top:14px">
            <a href="${appUrl}/soporte" style="color:#ff6b35;text-decoration:underline;font-size:14px">
              …or open a ticket and we'll get back to you →
            </a>
          </p>
        `,
      };
    }

    // 30 days
    const paidLine = isPaid
      ? `<p style="${STYLE.p}">Your plan is still active and renews every month. If it's no longer worth it for you, you can also cancel it right now, no hassle — we'd rather be honest than let you pay for something you aren't using.</p>`
      : '';
    return {
      subject: 'Your NeuroPost account is waiting for you',
      preview: 'One month without seeing you. Coming back?',
      html: `
        <h1 style="${STYLE.h1}">Your account is waiting</h1>
        <p style="${STYLE.p}">
          It has been a month since your last visit. Your brand, library and
          connections are all intact — you only need to come back when it suits you.
        </p>
        <p style="${STYLE.p}">
          Here's a deal: log in for 10 minutes, queue a post for this week,
          and forget about it. We'll do the rest.
        </p>
        ${paidLine}
        <a href="${appUrl}/dashboard" style="${STYLE.btn}">Back to NeuroPost →</a>
        ${isPaid
          ? `<p style="margin-top:14px">
              <a href="${appUrl}/settings/plan" style="color:#888;text-decoration:underline;font-size:13px">
                Cancel subscription
              </a>
            </p>`
          : ''}
      `,
    };
  },

  genericNotification: ({ brandName, type, message }): TemplateOutput => {
    const title   = NOTIF_TITLES[type] ?? 'NeuroPost notification';
    const cta     = NOTIF_CTA[type];
    const ctaHtml = cta
      ? `<a href="${APP_URL()}${cta.path}" style="${STYLE.btn}">${cta.label} →</a>`
      : `<a href="${APP_URL()}/dashboard" style="${STYLE.btn}">Go to NeuroPost →</a>`;
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
