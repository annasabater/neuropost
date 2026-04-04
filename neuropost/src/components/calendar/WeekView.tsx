'use client';

import type { ScheduledPost } from '@/types';
import { DayCell } from './DayCell';

interface Props {
  weekDates:  Date[];
  today:      Date;
  postsByDay: Map<string, ScheduledPost[]>;
  onDayClick?: (date: Date, posts: ScheduledPost[]) => void;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function WeekView({ weekDates, today, postsByDay, onDayClick }: Props) {
  return (
    <div className="week-view">
      {weekDates.map((date, i) => {
        const key   = date.toISOString().slice(0, 10);
        const posts = postsByDay.get(key) ?? [];
        return (
          <div key={key} className="week-view-col">
            <div className="week-day-label">{DAY_LABELS[i]}</div>
            <DayCell
              date={date}
              today={today}
              posts={posts}
              onClick={onDayClick}
            />
          </div>
        );
      })}
    </div>
  );
}
