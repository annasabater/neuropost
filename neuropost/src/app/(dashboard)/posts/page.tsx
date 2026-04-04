'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Filter } from 'lucide-react';
import type { Post, PostStatus } from '@/types';
import { useAppStore } from '@/store/useAppStore';

const STATUS_FILTERS: { value: PostStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'generated', label: 'Generado' },
  { value: 'pending',   label: 'Pendiente' },
  { value: 'approved',  label: 'Aprobado' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'published', label: 'Publicado' },
];

export default function PostsPage() {
  const setPosts      = useAppStore((s) => s.setPosts);
  const storePostList = useAppStore((s) => s.posts);

  const [posts,   setPosts_]  = useState<Post[]>([]);
  const [filter,  setFilter]  = useState<PostStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts?limit=50')
      .then((r) => r.json())
      .then((json) => {
        const list = json.posts ?? [];
        setPosts_(list);
        setPosts(list);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store updates (approvals, rejections done in detail page)
  useEffect(() => { if (storePostList.length) setPosts_(storePostList); }, [storePostList]);

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.status === filter);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Posts</h1>
          <p className="page-sub">Gestiona todo tu contenido</p>
        </div>
        <Link href="/posts/new" className="btn-primary btn-orange">
          <Plus size={16} /> Nuevo post
        </Link>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <Filter size={14} />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <p className="empty-state-title">Sin posts</p>
          <p className="empty-state-sub">Crea tu primer post con IA</p>
          <Link href="/posts/new" className="btn-primary btn-orange">Nuevo post</Link>
        </div>
      ) : (
        <div className="posts-list">
          {filtered.map((post) => {
            const platform = Array.isArray(post.platform) ? post.platform[0] : post.platform;
            return (
              <Link key={post.id} href={`/posts/${post.id}`} className="post-list-item post-list-link">
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image_url} alt="" className="post-list-thumb" />
                )}
                {!post.image_url && (
                  <div className="post-list-thumb-placeholder">{platform?.slice(0, 2).toUpperCase()}</div>
                )}
                <div className="post-list-info">
                  <p className="post-list-caption">
                    {post.caption ? `${post.caption.slice(0, 100)}…` : 'Sin caption'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    <span className="post-list-meta">{platform}</span>
                  </div>
                </div>
                <span className="post-list-date">
                  {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
