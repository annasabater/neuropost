'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ScheduledPost } from '@/types';
import { CalendarView } from '@/components/calendar/CalendarView';

export default function CalendarPage() {
  const [date,         setDate]        = useState(new Date());
  const [posts,        setPosts]       = useState<ScheduledPost[]>([]);
  const [storiesPerDay, setStoriesPerDay] = useState<Record<string, number>>({});
  const [loading,      setLoading]     = useState(false);
  const [selected,     setSelected]    = useState<{ date: Date; posts: ScheduledPost[] } | null>(null);

  const year  = date.getFullYear();
  const month = date.getMonth() + 1;

  // Fetch stories count per day for this month from DB
  const fetchStories = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts?month=${month}&year=${year}&is_story=true`);
      if (!res.ok) return;
      const json = await res.json();
      const map: Record<string, number> = {};
      for (const p of (json.posts ?? [])) {
        const day = (p.scheduled_at ?? p.published_at ?? p.created_at)?.slice(0, 10);
        if (day) map[day] = (map[day] ?? 0) + 1;
      }
      setStoriesPerDay(map);
    } catch { /* silent */ }
  }, [month, year]);

  const generate = useCallback(async () => {
    setLoading(true);
    fetchStories();
    try {
      const res = await fetch('/api/agents/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, postsPerWeek: 3, platforms: ['instagram', 'facebook'], country: 'ES' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al generar el calendario');
      setPosts(json.data.scheduledPosts ?? []);
      toast.success(`Calendario generado: ${json.data.scheduledPosts?.length ?? 0} posts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  return (
    <div className="page-content" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Calendario de contenido</h1>
          <p className="page-sub">Planifica y visualiza tus publicaciones del mes</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-outline icon-btn" onClick={() => setDate(subMonths(date, 1))} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="month-label">
            {format(date, 'MMMM yyyy', { locale: es })}
          </span>
          <button className="btn-outline icon-btn" onClick={() => setDate(addMonths(date, 1))} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
          <button className="btn-primary btn-orange" onClick={generate} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Zap size={16} />}
            {loading ? 'Generando…' : 'Generar calendario'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: '0.78rem', color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--orange)', display: 'inline-block' }} />
          Post
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg,#833AB4,#FD1D1D,#FCAF45)', display: 'inline-block' }} />
          Historia
        </span>
      </div>

      <CalendarView
        year={year}
        month={month}
        posts={posts}
        storiesPerDay={storiesPerDay}
        onDayClick={(d, p) => setSelected({ date: d, posts: p })}
      />

      {/* Day detail panel */}
      {selected && selected.posts.length > 0 && (
        <div className="day-detail-panel">
          <div className="day-detail-header">
            <span>{format(selected.date, 'EEEE d MMMM', { locale: es })}</span>
            <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
          {selected.posts.map((p) => (
            <div key={p.id} className="day-detail-post">
              <span className="interaction-platform">{p.platform}</span>
              <span style={{ fontSize: '0.85rem' }}>{p.time}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)', flex: 1 }}>{p.rationale}</span>
              {p.holidayName && <span className="status-badge status-scheduled">{p.holidayName}</span>}
            </div>
          ))}
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <div className="empty-state-icon"><Calendar size={36} color="var(--orange)" /></div>
          <p className="empty-state-title">Calendario vacío</p>
          <p className="empty-state-sub">Genera un calendario con IA para planificar el mes</p>
          <button className="btn-primary btn-orange" onClick={generate}>
            <Zap size={16} /> Generar calendario
          </button>
        </div>
      )}

      {posts.length > 0 && (
        <>
          <h2 className="section-title">Posts programados ({posts.length})</h2>
          <div className="posts-list">
            {posts.slice(0, 15).map((p) => (
              <div key={p.id} className="post-list-item">
                <div className="post-list-info">
                  <span className="interaction-platform">{p.platform}</span>
                  <span className="post-list-caption">{p.rationale || p.contentPieceId}</span>
                  {p.holidayName && <span className="status-badge status-scheduled">{p.holidayName}</span>}
                </div>
                <span className="post-list-date">{p.date} · {p.time}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
