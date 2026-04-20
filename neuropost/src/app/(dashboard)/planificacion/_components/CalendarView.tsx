'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Edit3, Calendar }        from 'lucide-react';
import { useRouter }                         from 'next/navigation';
import { RetouchModal }                      from './RetouchModal';
import { RescheduleModal }                   from './RescheduleModal';
import type { WeeklyPlan }                   from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface CalendarPost {
  id:                  string;
  content_idea_id:     string | null;
  caption:             string | null;
  image_url:           string | null;
  format:              string;
  scheduled_at:        string | null;
  status:              string;
  hashtags:            string[] | null;
  is_published:        boolean;
  has_pending_retouch: boolean;
}

interface Props {
  plan:   WeeklyPlan;
  weekId: string;
}

function getStatusMeta(post: CalendarPost): { label: string; color: string; bg: string; dot: string } {
  if (post.is_published)        return { label: 'Publicado',         color: '#065f46', bg: '#d1fae5', dot: '#10b981' };
  if (post.has_pending_retouch) return { label: 'Retoque pendiente', color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' };
  if (post.scheduled_at)        return { label: 'Programado',        color: '#065f46', bg: '#d1fae5', dot: '#0F766E' };
  return                               { label: 'Listo',             color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' };
}

function getWeekDays(weekStart: string): Date[] {
  const base = new Date(weekStart + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d;
  });
}

function isSameUTCDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === day.getUTCFullYear() &&
    d.getUTCMonth()    === day.getUTCMonth()    &&
    d.getUTCDate()     === day.getUTCDate()
  );
}

export function CalendarView({ plan, weekId }: Props) {
  const router = useRouter();
  const [posts,       setPosts]       = useState<CalendarPost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [retouching,  setRetouching]  = useState<CalendarPost | null>(null);
  const [rescheduling,setRescheduling]= useState<CalendarPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/client/weekly-plans/${weekId}/calendar`);
    const data = await res.json() as { posts?: CalendarPost[] };
    setPosts(data.posts ?? []);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)', fontFamily: f }}>Cargando calendario...</div>;
  }

  const weekDays = getWeekDays(plan.week_start);

  return (
    <div style={{ padding: '32px 28px', maxWidth: 800, color: 'var(--text-primary)', fontFamily: f }}>

      {/* Back */}
      <button type="button" onClick={() => router.push('/planificacion')} style={backBtn}>
        <ArrowLeft size={14} /> Mis planes
      </button>

      {/* Header */}
      <div style={{ marginTop: 20, marginBottom: 28 }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900,
          fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', margin: '0 0 6px', lineHeight: 1,
        }}>
          Semana del {formatWeek(plan.week_start)}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Todo listo. Estas son las publicaciones programadas para esta semana.
        </p>
      </div>

      {/* ── Mini weekly calendar strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        border: '1px solid var(--border)', marginBottom: 32,
        overflow: 'hidden',
      }}>
        {weekDays.map((day, i) => {
          const dayPosts = posts.filter((p) => p.scheduled_at && isSameUTCDay(p.scheduled_at, day));
          const isToday  = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={i}
              style={{
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                background: isToday ? 'rgba(15,118,110,0.04)' : 'var(--bg)',
              }}
            >
              {/* Day header */}
              <div style={{
                padding: '10px 0 8px',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                background: isToday ? 'rgba(15,118,110,0.08)' : 'var(--bg-1)',
              }}>
                <div style={{
                  fontFamily: fc, fontWeight: 800,
                  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  {DAYS_ES[i]}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                  lineHeight: 1.2,
                }}>
                  {day.getUTCDate()}
                </div>
              </div>
              {/* Post dots */}
              <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 40 }}>
                {dayPosts.map((p) => {
                  const m = getStatusMeta(p);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, color: 'var(--text-secondary)',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.format}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Posts ── */}
      {posts.length === 0 ? (
        <div style={{
          padding: '56px 32px', textAlign: 'center',
          border: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <Calendar size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px', display: 'block' }} />
          <p style={{
            fontFamily: fc, fontWeight: 800, fontSize: 16,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--text-primary)', margin: '0 0 6px',
          }}>
            Preparando publicaciones
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Las publicaciones se están preparando. Vuelve pronto.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map((post) => {
            const meta = getStatusMeta(post);
            return (
              <div key={post.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url} alt=""
                    style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }}
                  />
                )}

                <div style={{ padding: 20 }}>
                  {/* Date + pills row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {post.scheduled_at && (
                      <span style={{
                        fontFamily: fc, fontWeight: 700, fontSize: 15,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                        color: 'var(--text-primary)',
                      }}>
                        {formatDateTime(post.scheduled_at)}
                      </span>
                    )}
                    <span style={formatPill}>{post.format}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 9px',
                      background: meta.bg, color: meta.color,
                      textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.dot }} />
                      {meta.label}
                    </span>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p style={{ fontSize: 14, lineHeight: 1.65, margin: '0 0 10px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {post.caption}
                    </p>
                  )}

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                      {post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                    </p>
                  )}

                  {/* Actions */}
                  {!post.is_published && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!post.has_pending_retouch && (
                        <button type="button" onClick={() => setRetouching(post)} style={outlineBtn('var(--accent)')}>
                          <Edit3 size={13} /> Retocar
                        </button>
                      )}
                      <button type="button" onClick={() => setRescheduling(post)} style={outlineBtn('var(--text-secondary)')}>
                        <Calendar size={13} /> Reprogramar
                      </button>
                    </div>
                  )}
                  {post.has_pending_retouch && (
                    <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                      ⏳ Retoque pendiente de revisión
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {retouching && (
        <RetouchModal
          postId={retouching.id}
          currentCopy={retouching.caption}
          currentAt={retouching.scheduled_at}
          onClose={() => setRetouching(null)}
          onSuccess={load}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          postId={rescheduling.id}
          currentAt={rescheduling.scheduled_at}
          weekStart={plan.week_start}
          otherPostsAt={posts
            .filter((p) => p.id !== rescheduling.id && p.scheduled_at)
            .map((p) => p.scheduled_at!)}
          onClose={() => setRescheduling(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  });
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: f,
};
const formatPill: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px',
  background: 'var(--bg-1)', color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};
function outlineBtn(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', background: 'transparent', color,
    border: `1px solid ${color}`, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: f,
  };
}
