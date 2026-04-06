'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Filter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Post, PostStatus } from '@/types';
import { useAppStore } from '@/store/useAppStore';

export default function PostsPage() {
  const t = useTranslations('posts');
  const setPosts      = useAppStore((s) => s.setPosts);
  const storePostList = useAppStore((s) => s.posts);

  const [posts,   setPosts_]  = useState<Post[]>([]);
  const [filter,  setFilter]  = useState<PostStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const STATUS_FILTERS: { value: PostStatus | 'all'; label: string }[] = [
    { value: 'all',       label: t('status.all') },
    { value: 'draft',     label: t('status.draft') },
    { value: 'generated', label: t('status.generated') },
    { value: 'pending',   label: t('status.pending') },
    { value: 'approved',  label: t('status.approved') },
    { value: 'scheduled', label: t('status.scheduled') },
    { value: 'published', label: t('status.published') },
  ];

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
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
        <Link href="/posts/new" className="btn-primary btn-orange">
          <Plus size={16} /> {t('new.title')}
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
          <p className="empty-state-title">{t('empty.title')}</p>
          <p className="empty-state-sub">{t('empty.subtitle')}</p>
          <Link href="/posts/new" className="btn-primary btn-orange">{t('new.title')}</Link>
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
                    {post.caption ? `${post.caption.slice(0, 100)}…` : t('noCaption')}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    <span className="post-list-meta">{platform}</span>
                  </div>
                </div>
                <span className="post-list-date">
                  {new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
