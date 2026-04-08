'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { PostPreview } from '@/components/posts/PostPreview';
import { ApprovalPanel } from '@/components/posts/ApprovalPanel';
import { VersionsPanel } from '@/components/posts/VersionsPanel';
import { useAppStore } from '@/store/useAppStore';
import type { Post, PostVersion } from '@/types';
import toast from 'react-hot-toast';

export default function PostDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
  const brand      = useAppStore((s) => s.brand);
  const updatePost = useAppStore((s) => s.updatePost);
  const removePost = useAppStore((s) => s.removePost);
  const storePosts = useAppStore((s) => s.posts);

  const [post,        setPost]        = useState<Post | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [editCaption, setEditCaption] = useState(false);
  const [caption,     setCaption]     = useState('');

  useEffect(() => {
    const fromStore = storePosts.find((p) => p.id === id);
    if (fromStore) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPost(fromStore);
      setCaption(fromStore.caption ?? '');
      setLoading(false);
      return;
    }
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.post) { setPost(json.post); setCaption(json.post.caption ?? ''); }
      })
      .finally(() => setLoading(false));
  }, [id, storePosts]);

  async function handleApprove(postId: string) {
    const res  = await fetch(`/api/posts/${postId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    updatePost(postId, { status: 'approved' });
    setPost((p) => p ? { ...p, status: 'approved' } : p);
    toast.success('Post aprobado');
  }

  async function handleReject(postId: string) {
    const res  = await fetch(`/api/posts/${postId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    updatePost(postId, { status: 'cancelled' });
    removePost(postId);
    toast.success('Post rechazado');
    router.push('/posts');
  }

  async function handleSchedule(postId: string, scheduledAt: string) {
    const res  = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, scheduledAt }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    updatePost(postId, { status: 'scheduled', scheduled_at: scheduledAt });
    setPost((p) => p ? { ...p, status: 'scheduled', scheduled_at: scheduledAt } : p);
    toast.success('Post programado');
  }

  async function handlePublish(postId: string) {
    const res  = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    updatePost(postId, { status: 'published' });
    setPost((p) => p ? { ...p, status: 'published' } : p);
    toast.success('Post publicado');
  }

  async function handleRegenerate(postId: string) {
    const res  = await fetch(`/api/posts/${postId}/regenerate`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al regenerar');
    updatePost(postId, json.post);
    setPost(json.post);
    setCaption(json.post.caption ?? '');
    toast.success('Contenido regenerado con IA');
  }

  async function handleRevertVersion(version: PostVersion) {
    if (!post) return;
    // Save current as a new version first, then apply the old one
    const currentVersions: PostVersion[] = Array.isArray(post.versions) ? post.versions : [];
    if (post.caption) {
      currentVersions.push({ caption: post.caption, hashtags: post.hashtags ?? [], savedAt: new Date().toISOString() });
    }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: version.caption, hashtags: version.hashtags, versions: currentVersions }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error); return; }
    updatePost(post.id, json.post);
    setPost(json.post);
    setCaption(json.post.caption ?? '');
    toast.success('Versión restaurada');
  }

  async function saveCaption() {
    if (!post) return;
    // Archive current caption as a version snapshot before saving
    const prevVersions: PostVersion[] = Array.isArray(post.versions) ? post.versions : [];
    if (post.caption && post.caption !== caption) {
      prevVersions.push({ caption: post.caption, hashtags: post.hashtags ?? [], savedAt: new Date().toISOString() });
    }
    const res  = await fetch(`/api/posts/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, versions: prevVersions }) });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error); return; }
    updatePost(post.id, { caption, versions: prevVersions });
    setPost((p) => p ? { ...p, caption, versions: prevVersions } : p);
    setEditCaption(false);
    toast.success('Caption actualizado');
  }

  if (loading) return <div className="page-content"><span className="loading-spinner" /></div>;
  if (!post)   return <div className="page-content"><p>Post no encontrado.</p></div>;

  const primaryPlatform = Array.isArray(post.platform) ? post.platform[0] : post.platform;

  return (
    <div className="page-content" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <Link href="/posts" className="back-link">
          <ArrowLeft size={16} /> Volver a Posts
        </Link>
      </div>

      <div className="post-detail-layout">
        {/* Left: preview */}
        <div className="post-detail-preview">
          <PostPreview
            imageUrl={post.image_url}
            caption={post.caption ?? ''}
            hashtags={post.hashtags}
            platform={primaryPlatform}
            format={post.format}
            brandName={brand?.name}
          />
        </div>

        {/* Right: details + actions */}
        <div className="post-detail-panel">
          {/* Approval panel — first so quality score is prominent */}
          {(post.status === 'generated' || post.status === 'pending' || post.status === 'approved') && (
            <div className="settings-section">
              <div className="settings-section-title">Acción</div>
              <ApprovalPanel
                post={post}
                onApprove={handleApprove}
                onReject={handleReject}
                onSchedule={handleSchedule}
                onPublish={handlePublish}
                onRegenerate={handleRegenerate}
              />
            </div>
          )}

          {/* Caption */}
          <div className="settings-section">
            <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Caption
              <button
                className="btn-outline"
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={() => setEditCaption((v) => !v)}
              >
                <Edit2 size={13} /> Editar
              </button>
            </div>
            {editCaption ? (
              <div>
                <textarea
                  className="editor-textarea caption-textarea"
                  value={caption}
                  placeholder="Escribe el caption del post"
                  title="Caption del post"
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn-primary btn-orange" onClick={saveCaption}>Guardar</button>
                  <button className="btn-outline" onClick={() => { setEditCaption(false); setCaption(post.caption ?? ''); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--ink)' }}>
                {post.caption || <em style={{ color: 'var(--muted)' }}>Sin caption</em>}
              </p>
            )}
          </div>

          {/* Hashtags */}
          {post.hashtags.length > 0 && (
            <div className="settings-section">
              <div className="settings-section-title">Hashtags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {post.hashtags.map((h) => (
                  <span key={h} className="tag-chip">#{h.replace(/^#/, '')}</span>
                ))}
              </div>
            </div>
          )}

          {/* Version history */}
          {Array.isArray(post.versions) && post.versions.length > 0 && (
            <VersionsPanel versions={post.versions} onRevert={handleRevertVersion} />
          )}

          {/* Meta info */}
          <div className="settings-section">
            <div className="settings-section-title">Detalles</div>
            <dl className="post-meta-list">
              <dt>Estado</dt>   <dd><span className={`status-badge status-${post.status}`}>{post.status}</span></dd>
              <dt>Formato</dt>  <dd style={{ textTransform: 'capitalize' }}>{post.format}</dd>
              <dt>Plataforma</dt><dd style={{ textTransform: 'capitalize' }}>{Array.isArray(post.platform) ? post.platform.join(', ') : post.platform}</dd>
              {post.scheduled_at && <><dt>Programado</dt><dd>{new Date(post.scheduled_at).toLocaleString('es-ES')}</dd></>}
              {post.published_at && <><dt>Publicado</dt><dd>{new Date(post.published_at).toLocaleString('es-ES')}</dd></>}
              <dt>Creado</dt>   <dd>{new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}