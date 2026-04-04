'use client';

import {
  getDaysInMonth,
  startOfMonth,
  getDay,
  addDays,
} from 'date-fns';
import type { ScheduledPost } from '@/types';
import { DayCell } from './DayCell';

interface Props {
  year:          number;
  month:         number; // 1-12
  posts:         ScheduledPost[];
  storiesPerDay?: Record<string, number>; // ISO date → story count
  onDayClick?:   (date: Date, posts: ScheduledPost[]) => void;
}

const HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarView({ year, month, posts, storiesPerDay = {}, onDayClick }: Props) {
  const today      = new Date();
  const firstDay   = startOfMonth(new Date(year, month - 1, 1));
  // getDay returns 0=Sunday. Convert to Mon-based index.
  const startIndex = (getDay(firstDay) + 6) % 7; // Mon=0 … Sun=6
  const daysCount  = getDaysInMonth(firstDay);

  // Build postsByDay map: ISO date → ScheduledPost[]
  const postsByDay = new Map<string, ScheduledPost[]>();
  for (const p of posts) {
    const list = postsByDay.get(p.date) ?? [];
    list.push(p);
    postsByDay.set(p.date, list);
  }

  // Build cell array with leading/trailing empty dates
  const cells: (Date | null)[] = [];
  // Leading empty cells (days before month starts)
  for (let i = 0; i < startIndex; i++) cells.push(null);
  // Month days
  for (let d = 1; d <= daysCount; d++) cells.push(new Date(year, month - 1, d));
  // Trailing empty cells to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar-wrap">
      <div className="calendar-grid">
        {HEADERS.map((h) => (
          <div key={h} className="cal-header-cell">{h}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="cal-cell empty" />;
          const key   = date.toISOString().slice(0, 10);
          const dayPosts = postsByDay.get(key) ?? [];
          return (
            <DayCell
              key={key}
              date={date}
              today={today}
              posts={dayPosts}
              storiesCount={storiesPerDay[key] ?? 0}
              onClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}
