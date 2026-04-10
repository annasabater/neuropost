'use client';

import { useEffect } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/store/useAppStore';
import type { NotificationType } from '@/types';

const TYPE_ICON: Record<string, string> = {
  approval_needed: '⏳',
  published:       '✅',
  failed:          '❌',
  comment:         '💬',
  limit_reached:   '🚫',
  meta_connected:  '🔗',
  token_expired:   '⚠️',
  payment_failed:  '💳',
  plan_activated:  '🎉',
  team_invite:     '👥',
  trend_detected:  '🔥',
};

const TYPE_LINK: Record<string, string> = {
  approval_needed: '/posts',
  published:       '/posts',
  failed:          '/posts',
  comment:         '/comments',
  limit_reached:   '/settings/plan',
  meta_connected:  '/settings#redes',
  token_expired:   '/settings#redes',
  payment_failed:  '/settings/plan',
  plan_activated:  '/settings/plan',
  team_invite:     '/settings/team',
  trend_detected:  '/tendencias',
};

const TYPE_COLOR: Record<string, string> = {
  approval_needed: '#d97706',
  published:       '#0F766E',
  failed:          '#dc2626',
  comment:         '#2563eb',
  limit_reached:   '#dc2626',
  meta_connected:  '#0F766E',
  token_expired:   '#d97706',
  payment_failed:  '#dc2626',
  plan_activated:  '#0F766E',
  team_invite:     '#7c3aed',
  trend_detected:  '#ea580c',
};

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const notifications          = useAppStore((s) => s.notifications);
  const setNotifications       = useAppStore((s) => s.setNotifications);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const markNotificationRead   = useAppStore((s) => s.markNotificationRead);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data: { notifications?: import('@/types').Notification[] }) => {
        if (data.notifications) setNotifications(data.notifications);
      })
      .catch(() => { /* silently ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark all as read when opening the page
  useEffect(() => {
    async function markRead() {
      await fetch('/api/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ all: true }),
      });
      markAllNotificationsRead();
    }
    markRead().catch(() => { /* silently ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group by day using locale-aware date formatting
  const grouped = notifications.reduce<Record<string, typeof notifications>>((acc, n) => {
    const day = new Date(n.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(n);
    return acc;
  }, {});

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="page-content" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">
            {unread > 0
              ? t('unread', { count: unread })
              : t('upToDate')}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn-outline" onClick={markAllNotificationsRead}>
            <CheckCheck size={16} /> {t('markAllRead')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={36} color="var(--orange)" /></div>
          <p className="empty-state-title">{t('emptyTitle')}</p>
          <p className="empty-state-sub">{t('emptySub')}</p>
        </div>
      ) : (
        <div className="notif-list">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <p style={{
                fontSize:     '0.72rem',
                fontWeight:   700,
                color:        'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding:       '16px 0 8px',
              }}>
                {day}
              </p>
              {items.map((n) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const label = TYPE_ICON[n.type] ? t(`types.${n.type}` as any) : n.type;
                const icon  = TYPE_ICON[n.type]  ?? '📌';
                const link  = TYPE_LINK[n.type as NotificationType] ?? '/dashboard';
                const color = TYPE_COLOR[n.type]  ?? 'var(--muted)';

                return (
                  <div
                    key={n.id}
                    className={`notif-item${n.read ? '' : ' unread'}`}
                    onClick={() => markNotificationRead(n.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span
                      className="notif-icon"
                      style={{
                        background: `${color}15`,
                        borderRadius: '50%',
                        width: 38,
                        height: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '1.1rem',
                      }}
                    >
                      {icon}
                    </span>
                    <div className="notif-body" style={{ flex: 1 }}>
                      <p className="notif-type" style={{ color }}>{label}</p>
                      <p className="notif-message">{n.message}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span className="notif-date">
                        {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Link
                        href={link}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        style={{
                          display:    'flex',
                          alignItems: 'center',
                          gap:        4,
                          fontSize:   '0.72rem',
                          color:      'var(--muted)',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={11} /> {t('view')}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
