'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type CalPost = {
  id: string; caption: string | null; status: string;
  image_url: string | null; scheduled_at: string | null;
  published_at: string | null; created_at: string;
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarPage() {
  const brand = useAppStore((s) => s.brand);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?limit=100&_t=${Date.now()}`);
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Re-fetch on mount and when navigating back to this page
  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => {
    function onFocus() { fetchPosts(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchPosts]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Important dates
  const IMPORTANT_DATES = [
    { name: 'Sant Jordi', date: '2026-04-23' },
    { name: 'Dia de la Mare', date: '2026-05-03' },
    { name: 'Dia del Pare', date: '2026-03-19' },
    { name: 'Dia del Treballador', date: '2026-05-01' },
    { name: 'Rebaixes estiu', date: '2026-07-01' },
    { name: 'La Mercè', date: '2026-09-24' },
    { name: 'Halloween', date: '2026-10-31' },
    { name: 'Black Friday', date: '2026-11-27' },
    { name: 'Nadal', date: '2026-12-25' },
    { name: 'Cap d\'Any', date: '2026-12-31' },
    { name: 'Reis', date: '2027-01-06' },
    { name: 'Sant Valentí', date: '2027-02-14' },
  ];
  const datesByDay: Record<number, string> = {};
  for (const d of IMPORTANT_DATES) {
    const dt = new Date(d.date);
    if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
      datesByDay[dt.getDate()] = d.name;
    }
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  // Group posts by day — only scheduled and published
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

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Calendario
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Visualiza y organiza tus publicaciones
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

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} color="#6b7280" />
        </button>
        <span style={{ fontFamily: fc, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
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
              const cellIdx = row * 7 + col;
              const day = cellIdx - firstDay + 1;
              const isValid = day >= 1 && day <= daysInMonth;
              const dayPosts = isValid ? (postsByDay[day] ?? []) : [];
              const todayCell = isValid && isToday(day);
              const importantDate = isValid ? datesByDay[day] : undefined;

              return (
                <div key={col} style={{
                  minHeight: 80, padding: '6px 8px',
                  borderRight: col < 6 ? '1px solid #e5e7eb' : 'none',
                  background: importantDate ? '#fffbeb' : todayCell ? '#f0fdf4' : isValid ? '#ffffff' : '#f9fafb',
                }}>
                  {isValid && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: f, fontSize: 12, fontWeight: todayCell || importantDate ? 700 : 400, color: todayCell ? '#0F766E' : importantDate ? '#e65100' : '#111827' }}>
                          {day}
                        </span>
                      </div>
                      {importantDate && (
                        <div style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#e65100', background: '#fff3e0', padding: '1px 4px', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {importantDate}
                        </div>
                      )}
                      {dayPosts.slice(0, 3).map(p => {
                        const isScheduled = p.status === 'scheduled';
                        const dotColor = STATUS_DOT[p.status] ?? '#d1d5db';
                        return (
                          <Link key={p.id} href={`/posts/${p.id}`} style={{
                            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
                            textDecoration: 'none', padding: '2px 4px',
                            background: isScheduled ? 'rgba(15,118,110,0.1)' : '#f3f4f6',
                            borderLeft: `2px solid ${dotColor}`,
                            transition: 'background 0.1s',
                          }}>
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" style={{ width: 16, height: 16, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 4, height: 4, background: dotColor, borderRadius: '50%', flexShrink: 0 }} />
                            )}
                            <span style={{ fontFamily: f, fontSize: 10, color: isScheduled ? '#0F766E' : '#374151', fontWeight: isScheduled ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.caption?.slice(0, 18) ?? (STATUS_LABEL_CAL[p.status] ?? p.status)}
                            </span>
                          </Link>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <span style={{ fontFamily: f, fontSize: 9, color: '#9ca3af' }}>+{dayPosts.length - 3} más</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24, marginTop: 24, fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
        <span>{posts.filter(p => p.status === 'scheduled').length} programados</span>
        <span>{posts.filter(p => p.status === 'published').length} publicados</span>
        <span>{posts.filter(p => ['pending', 'draft', 'request'].includes(p.status)).length} pendientes</span>
      </div>
    </div>
  );
}
