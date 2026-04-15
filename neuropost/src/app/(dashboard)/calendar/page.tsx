'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type CalPost = {
  id: string; caption: string | null; status: string;
  image_url: string | null; scheduled_at: string | null;
  published_at: string | null; created_at: string;
};

type CalEvent = {
  id: string;
  title: string;
  date: string;           // YYYY-MM-DD
  type: string;           // 'holiday' | 'cultural' | 'commercial' | 'local' | 'awareness'
  relevance: string;      // 'high' | 'medium' | 'low'
  description: string | null;
  suggested_content_idea: string | null;
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STATUS_DOT: Record<string, string> = {
  scheduled: '#0F766E', published: '#0F766E', approved: '#1565c0',
  pending: '#e65100', draft: '#d1d5db', request: '#0F766E',
};

const STATUS_LABEL_CAL: Record<string, string> = {
  scheduled: 'Programado', published: 'Publicado', approved: 'Aprobado',
  pending: 'Pendiente', draft: 'Borrador', request: 'En preparación',
};

const EVENT_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  holiday:    { bg: '#fff3e0', text: '#b45309', dot: '#f59e0b' },
  cultural:   { bg: '#fdf4ff', text: '#7e22ce', dot: '#a855f7' },
  commercial: { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  local:      { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  awareness:  { bg: '#fff0f9', text: '#be185d', dot: '#ec4899' },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Tooltip for event details
function EventTooltip({ event }: { event: CalEvent }) {
  const [open, setOpen] = useState(false);
  const colors = EVENT_COLOR[event.type] ?? EVENT_COLOR.holiday;
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <div style={{
        fontFamily: f, fontSize: 9, fontWeight: 600, color: colors.text,
        background: colors.bg, padding: '1px 4px', marginBottom: 2,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        borderLeft: `2px solid ${colors.dot}`, cursor: 'default',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {event.title}
      </div>
      {open && (event.description ?? event.suggested_content_idea) && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
          background: '#111827', color: '#ffffff', padding: '8px 10px',
          fontSize: 11, fontFamily: f, lineHeight: 1.5, width: 220,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', pointerEvents: 'none',
        }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>{event.title}</p>
          {event.description && <p style={{ color: '#d1d5db', marginBottom: event.suggested_content_idea ? 6 : 0 }}>{event.description}</p>}
          {event.suggested_content_idea && (
            <p style={{ color: '#0D9488', fontStyle: 'italic' }}>💡 {event.suggested_content_idea}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const brand = useAppStore((s) => s.brand);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [noHolidays, setNoHolidays] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, eventsRes] = await Promise.all([
        fetch(`/api/posts?limit=100&_t=${Date.now()}`),
        fetch(`/api/calendar-events?year=${year}`),
      ]);
      const postsJson  = await postsRes.json();
      const eventsJson = await eventsRes.json();
      setPosts(postsJson.posts ?? []);
      const fetched = (eventsJson.events ?? []) as CalEvent[];
      setEvents(fetched);
      setNoHolidays(fetched.length === 0);
    } catch { /* silent */ }
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    function onFocus() { fetchData(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Index events by day for current month
  const eventsByDay: Record<number, CalEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfWeek(year, month);
  const today       = new Date();
  const isToday     = (d: number) => d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  // Group posts by day
  const postsByDay: Record<number, CalPost[]> = {};
  for (const p of posts) {
    if (p.status !== 'scheduled' && p.status !== 'published') continue;
    const dateStr = p.scheduled_at ?? p.published_at;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(p);
    }
  }

  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  // Count events in current month
  const monthEventCount = Object.values(eventsByDay).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Calendario
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Publicaciones programadas y fechas clave de tu zona
          </p>
        </div>
        <Link href="/posts/new" style={{
          padding: '8px 20px', background: '#111827', color: '#ffffff', textDecoration: 'none',
          fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <Plus size={14} /> Nuevo contenido
        </Link>
      </div>

      {/* No holidays notice */}
      {!loading && noHolidays && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', padding: '12px 16px',
          fontFamily: f, fontSize: 13, color: '#92400e', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Calendar size={15} />
          <span>
            El agente de festivos se activará automáticamente al completar tu perfil de ubicación.
            {brand?.location ? ` Ubicación registrada: ${brand.location}.` : ' Configura tu ubicación en Ajustes → Mi negocio.'}
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} color="#6b7280" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: fc, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          {monthEventCount > 0 && (
            <span style={{ fontFamily: f, fontSize: 11, color: '#b45309', background: '#fff3e0', padding: '2px 8px', marginLeft: 10, fontWeight: 700 }}>
              {monthEventCount} fechas clave
            </span>
          )}
        </div>
        <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} color="#6b7280" />
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid #e5e7eb' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '8px', textAlign: 'center', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: row < rows - 1 ? '1px solid #e5e7eb' : 'none' }}>
            {Array.from({ length: 7 }).map((_, col) => {
              const cellIdx  = row * 7 + col;
              const day      = cellIdx - firstDay + 1;
              const isValid  = day >= 1 && day <= daysInMonth;
              const dayPosts = isValid ? (postsByDay[day] ?? []) : [];
              const dayEvts  = isValid ? (eventsByDay[day] ?? []) : [];
              const todayCell = isValid && isToday(day);
              const hasHighEvent = dayEvts.some((e) => e.relevance === 'high');

              return (
                <div key={col} style={{
                  minHeight: 88, padding: '6px 8px',
                  borderRight: col < 6 ? '1px solid #e5e7eb' : 'none',
                  background: hasHighEvent ? '#fffbeb' : todayCell ? '#f0fdf4' : isValid ? '#ffffff' : '#f9fafb',
                }}>
                  {isValid && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{
                          fontFamily: f, fontSize: 12,
                          fontWeight: todayCell || hasHighEvent ? 700 : 400,
                          color: todayCell ? '#0F766E' : hasHighEvent ? '#b45309' : '#111827',
                        }}>
                          {day}
                        </span>
                        {dayEvts.length > 0 && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: EVENT_COLOR[dayEvts[0].type]?.dot ?? '#f59e0b', flexShrink: 0 }} />
                        )}
                      </div>

                      {/* Holiday/cultural events */}
                      {dayEvts.slice(0, 2).map((e) => (
                        <EventTooltip key={e.id} event={e} />
                      ))}
                      {dayEvts.length > 2 && (
                        <span style={{ fontFamily: f, fontSize: 9, color: '#9ca3af' }}>+{dayEvts.length - 2} eventos</span>
                      )}

                      {/* Posts */}
                      {dayPosts.slice(0, 2).map(p => {
                        const isScheduled = p.status === 'scheduled';
                        const dotColor = STATUS_DOT[p.status] ?? '#d1d5db';
                        return (
                          <Link key={p.id} href={`/posts/${p.id}`} style={{
                            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
                            textDecoration: 'none', padding: '2px 4px',
                            background: isScheduled ? 'rgba(15,118,110,0.1)' : '#f3f4f6',
                            borderLeft: `2px solid ${dotColor}`,
                          }}>
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" style={{ width: 14, height: 14, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 4, height: 4, background: dotColor, borderRadius: '50%', flexShrink: 0 }} />
                            )}
                            <span style={{ fontFamily: f, fontSize: 10, color: isScheduled ? '#0F766E' : '#374151', fontWeight: isScheduled ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.caption?.slice(0, 16) ?? (STATUS_LABEL_CAL[p.status] ?? p.status)}
                            </span>
                          </Link>
                        );
                      })}
                      {dayPosts.length > 2 && (
                        <span style={{ fontFamily: f, fontSize: 9, color: '#9ca3af' }}>+{dayPosts.length - 2} posts</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
          {Object.entries(EVENT_COLOR).map(([type, colors]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
              {type === 'holiday' ? 'Festivo' : type === 'cultural' ? 'Cultural' : type === 'commercial' ? 'Comercial' : type === 'local' ? 'Local' : 'Concienciación'}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
          <span>{posts.filter(p => p.status === 'scheduled').length} programados</span>
          <span>{posts.filter(p => p.status === 'published').length} publicados</span>
          <span>{posts.filter(p => ['pending', 'draft', 'request'].includes(p.status)).length} pendientes</span>
        </div>
      </div>
    </div>
  );
}
