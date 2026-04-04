'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, FileText, Clock, Image, BarChart3 } from 'lucide-react';
import type { Post } from '@/types';

interface WeeklyStats {
  published: Post[];
  pending:   number;
  stories:   number;
}

function getWeekStart(): Date {
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // Monday-based week
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function ResumenPage() {
  const [stats,   setStats]   = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res  = await fetch('/api/posts?limit=50');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al cargar los posts');

        const allPosts: Post[] = json.posts ?? [];
        const weekStart        = getWeekStart();

        const publishedThisWeek = allPosts.filter((p) => {
          if (p.status !== 'published' || !p.published_at) return false;
          return new Date(p.published_at) >= weekStart;
        });

        const pendingCount = allPosts.filter(
          (p) => p.status === 'pending' || p.status === 'generated',
        ).length;

        const storiesCount = publishedThisWeek.filter((p) => p.is_story).length;

        setStats({
          published: publishedThisWeek,
          pending:   pendingCount,
          stories:   storiesCount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Resumen de la semana</h1>
          <p className="page-sub">Actividad de los ultimos 7 dias</p>
        </div>
        <Link
          href="/analytics"
          className="btn-primary btn-orange"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <BarChart3 size={16} />
          Generar informe completo
        </Link>
      </div>

      {loading && (
        <div className="empty-state">
          <span className="loading-spinner" style={{ width: 28, height: 28 }} />
          <p className="empty-state-sub" style={{ marginTop: 12 }}>Cargando datos…</p>
        </div>
      )}

      {error && (
        <div style={{
          padding:      '14px 18px',
          borderRadius: 10,
          background:   '#fef2f2',
          border:       '1px solid #fca5a5',
          color:        '#b91c1c',
          fontSize:     '0.88rem',
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Summary cards */}
          <div className="stats-grid" style={{ marginBottom: 32 }}>
            <div className="stat-card">
              <FileText size={22} className="stat-icon" />
              <div>
                <p className="stat-label">Posts publicados esta semana</p>
                <p className="stat-value">{stats.published.length}</p>
              </div>
            </div>

            <div
              className="stat-card"
              style={
                stats.pending > 0
                  ? { border: '1px solid var(--orange)', background: 'var(--orange-light)' }
                  : undefined
              }
            >
              <Clock
                size={22}
                className="stat-icon"
                style={stats.pending > 0 ? { color: 'var(--orange)' } : undefined}
              />
              <div>
                <p className="stat-label">Posts pendientes</p>
                <p
                  className="stat-value"
                  style={stats.pending > 0 ? { color: 'var(--orange)' } : undefined}
                >
                  {stats.pending}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <Image size={22} className="stat-icon" />
              <div>
                <p className="stat-label">Stories publicadas</p>
                <p className="stat-value">{stats.stories}</p>
              </div>
            </div>
          </div>

          {/* Published posts list */}
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} style={{ color: 'var(--orange)' }} />
            Posts publicados esta semana
          </h2>

          {stats.published.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 16 }}>
              <div className="empty-state-icon">
                <FileText size={32} color="var(--muted)" />
              </div>
              <p className="empty-state-title">Sin posts publicados esta semana</p>
              <p className="empty-state-sub">
                Crea y aprueba posts para verlos aqui
              </p>
              <Link href="/posts/new" className="btn-primary btn-orange">
                Nuevo post
              </Link>
            </div>
          ) : (
            <div className="posts-list" style={{ marginBottom: 32 }}>
              {stats.published.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="post-list-item post-list-link"
                >
                  <div className="post-list-info">
                    <p className="post-list-caption">
                      {post.caption
                        ? `${post.caption.slice(0, 100)}…`
                        : 'Sin caption'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`status-badge status-${post.status}`}>
                        {post.status}
                      </span>
                      {post.is_story && (
                        <span style={{
                          fontSize:     '0.72rem',
                          fontWeight:   700,
                          color:        'var(--orange)',
                          background:   'var(--orange-light)',
                          padding:      '2px 8px',
                          borderRadius: 20,
                          border:       '1px solid var(--orange)',
                        }}>
                          Story
                        </span>
                      )}
                      {post.format && (
                        <span style={{
                          fontSize:   '0.72rem',
                          color:      'var(--muted)',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {post.format}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="post-list-date">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('es-ES', {
                          day:   'numeric',
                          month: 'short',
                          hour:  '2-digit',
                          minute:'2-digit',
                        })
                      : '—'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
