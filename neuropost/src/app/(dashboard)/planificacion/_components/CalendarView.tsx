'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Edit3, Calendar }          from 'lucide-react';
import { useRouter }                          from 'next/navigation';
import { RetouchModal }                       from './RetouchModal';
import { RescheduleModal }                    from './RescheduleModal';
import type { WeeklyPlan }                    from '@/types';

const C = {
  card: '#ffffff', border: '#E5E7EB', text: '#111111',
  muted: '#6B7280', accent: '#0F766E', amber: '#F59E0B',
};

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

export function CalendarView({ plan, weekId }: Props) {
  const router = useRouter();
  const [posts,    setPosts]    = useState<CalendarPost[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [retouching,    setRetouching]    = useState<CalendarPost | null>(null);
  const [rescheduling,  setRescheduling]  = useState<CalendarPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/client/weekly-plans/${weekId}/calendar`);
    const data = await res.json() as { posts?: CalendarPost[] };
    setPosts(data.posts ?? []);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando calendario...</div>;

  return (
    <div style={{ padding: 28, maxWidth: 760, color: C.text }}>
      {/* Header */}
      <button onClick={() => router.push('/planificacion')} style={backBtn}>
        <ArrowLeft size={14} /> Mis planes
      </button>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
          Tu calendario de la semana del {formatWeek(plan.week_start)}
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          Todo listo. Estas son las publicaciones que saldrán esta semana.
          Si quieres retocar algo, dínoslo.
        </p>
      </div>

      {posts.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', border: `1px solid ${C.border}` }}>
          <p style={{ color: C.muted, fontSize: 14 }}>
            Las publicaciones se están preparando. Vuelve pronto.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map((post) => {
            const statusMeta = resolveStatusMeta(post);
            return (
              <div key={post.id} style={{ background: C.card, border: `1px solid ${C.border}` }}>
                {/* Image */}
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url} alt=""
                    style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }}
                  />
                )}

                <div style={{ padding: 20 }}>
                  {/* Date + format + status row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    {post.scheduled_at && (
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                        {formatDateTime(post.scheduled_at)}
                      </span>
                    )}
                    <span style={pill}>{post.format}</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', background: statusMeta.bg, color: statusMeta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 10px', color: C.text, whiteSpace: 'pre-wrap' }}>
                      {post.caption}
                    </p>
                  )}

                  {/* Hashtags */}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
                      {post.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                    </p>
                  )}

                  {/* Action buttons */}
                  {!post.is_published && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!post.has_pending_retouch && (
                        <button onClick={() => setRetouching(post)} style={retouchBtn}>
                          <Edit3 size={13} /> Retocar
                        </button>
                      )}
                      <button onClick={() => setRescheduling(post)} style={rescheduleBtn}>
                        <Calendar size={13} /> Reprogramar
                      </button>
                    </div>
                  )}
                  {post.has_pending_retouch && (
                    <span style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>
                      ⏳ Retoque pendiente de revisión
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Retouch modal */}
      {retouching && (
        <RetouchModal
          postId={retouching.id}
          currentCopy={retouching.caption}
          currentAt={retouching.scheduled_at}
          onClose={() => setRetouching(null)}
          onSuccess={load}
        />
      )}

      {/* Reschedule modal */}
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

function resolveStatusMeta(post: CalendarPost): { label: string; color: string; bg: string } {
  if (post.is_published)        return { label: 'Publicado',         color: '#10b981', bg: '#f0fdf4' };
  if (post.has_pending_retouch) return { label: 'Retoque pendiente', color: '#f59e0b', bg: '#fef3c7' };
  if (post.scheduled_at)        return { label: 'Programado',        color: '#0F766E', bg: '#f0fdf4' };
  return                               { label: 'Listo',             color: '#6B7280', bg: '#f5f5f5' };
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
  padding: '6px 12px', background: 'transparent', border: '1px solid #E5E7EB',
  color: '#6B7280', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
};
const pill: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', background: '#f5f5f5', color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: 0.5,
};
const retouchBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: 'transparent', color: C.accent,
  border: `1px solid ${C.accent}`, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};
const rescheduleBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};
