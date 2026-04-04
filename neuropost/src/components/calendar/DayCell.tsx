'use client';

import type { ScheduledPost } from '@/types';

interface Props {
  date:         Date;
  today:        Date;
  posts:        ScheduledPost[];
  storiesCount?: number;
  isOtherMonth?: boolean;
  onClick?:     (date: Date, posts: ScheduledPost[]) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'cal-pill-ig',
  facebook:  'cal-pill-fb',
};

export function DayCell({ date, today, posts, storiesCount = 0, isOtherMonth = false, onClick }: Props) {
  const isToday = date.toDateString() === today.toDateString();

  return (
    <div
      className={`cal-cell${isToday ? ' today' : ''}${isOtherMonth ? ' other-month' : ''}`}
      onClick={() => onClick?.(date, posts)}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <span className="cal-date">{date.getDate()}</span>
      {posts.slice(0, 3).map((p) => (
        <div
          key={p.id}
          className={`cal-post-pill ${PLATFORM_COLORS[p.platform] ?? ''}`}
          title={`${p.time} — ${p.platform}`}
        >
          {p.time} {p.platform.slice(0, 2).toUpperCase()}
          {p.isHoliday && ' 🎉'}
        </div>
      ))}
      {posts.length > 3 && (
        <div className="cal-more">+{posts.length - 3} más</div>
      )}
      {/* Stories — blue circles like Instagram */}
      {storiesCount > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
          {Array.from({ length: Math.min(storiesCount, 3) }).map((_, i) => (
            <div
              key={i}
              title="Historia"
              style={{
                width:        10,
                height:       10,
                borderRadius: '50%',
                background:   'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)',
                flexShrink:   0,
              }}
            />
          ))}
          {storiesCount > 3 && (
            <span style={{ fontSize: '0.6rem', color: 'var(--muted)', lineHeight: '10px' }}>+{storiesCount - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
