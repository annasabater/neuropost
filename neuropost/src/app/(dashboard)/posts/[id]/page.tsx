'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Calendar, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { VersionsPanel } from '@/components/posts/VersionsPanel';
import { AssetVersions } from '@/components/posts/AssetVersions';
import { TikTokDownload } from '@/components/posts/TikTokDownload';
import { useAppStore } from '@/store/useAppStore';
import type { Post, PostVersion } from '@/types';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function PostDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const router     = useRouter();
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

  async function handleRevertVersion(version: PostVersion) {
    if (!post) return;
    // Archive current state as a new version snapshot before applying the old one
    const currentVersions: PostVersion[] = Array.isArray(post.versions) ? post.versions : [];
    if (post.caption) {
      currentVersions.push({
        caption:   post.caption,
        hashtags:  post.hashtags ?? [],
        savedAt:   new Date().toISOString(),
        image_url: post.image_url ?? null,
      });
    }
    const patchBody: Record<string, unknown> = {
      caption:  version.caption,
      hashtags: version.hashtags,
      versions: currentVersions,
    };
    // Restore image too if the version had one
    if (version.image_url) patchBody.image_url = version.image_url;

    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
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
      prevVersions.push({ caption: post.caption, hashtags: post.hashtags ?? [], savedAt: new Date().toISOString(), image_url: post.image_url ?? null });
    }
    const res  = await fetch(`/api/posts/${post.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, versions: prevVersions }) });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error); return; }
    updatePost(post.id, { caption, versions: prevVersions });
    setPost((p) => p ? { ...p, caption, versions: prevVersions } : p);
    setEditCaption(false);
    toast.success('Caption actualizado');
  }

  // ── Shared state (must be before early returns to respect Rules of Hooks) ──
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regenerating, setRegenerating]   = useState(false);
  const [scheduleDate, setScheduleDate]   = useState('');
  const [scheduleTime, setScheduleTime]   = useState('10:00');

  // ── Quota & regeneration state ──────────────────────────────────────────────
  interface QuotaInfo {
    photoPostsRemaining: number; videoPostsRemaining: number;
    photoPostsLimit: number;     videoPostsLimit: number;
    plan: string;
  }
  interface RegenCheck {
    allowed: boolean; willCostQuota: boolean;
    quotaAfter?: number; regenerationCount: number;
    reason?: string; upgradeUrl?: string;
  }
  const [quota,       setQuota]       = useState<QuotaInfo | null>(null);
  const [regenCheck,  setRegenCheck]  = useState<RegenCheck | null>(null);
  const [regenConfirm, setRegenConfirm] = useState(false);

  // Sync schedule state when post loads
  useEffect(() => {
    if (!post) return;
    if (post.scheduled_at) {
      setScheduleDate(post.scheduled_at.slice(0, 10));
      setScheduleTime(post.scheduled_at.slice(11, 16) || '10:00');
    }
  }, [post]);

  // Fetch weekly quota once on mount
  useEffect(() => {
    fetch('/api/quota')
      .then((r) => r.json())
      .then((json) => { if (!json.error) setQuota(json); })
      .catch(() => {});
  }, []);

  if (loading) return <div className="page-content"><span className="loading-spinner" /></div>;
  if (!post)   return <div className="page-content"><p>Post no encontrado.</p></div>;

  const primaryPlatform = Array.isArray(post.platform) ? post.platform[0] : post.platform;

  // Parse request metadata from ai_explanation (new format) or from caption (legacy)
  const requestMeta = (() => {
    if (post.status !== 'request') return null;
    if (post.ai_explanation) {
      try { return JSON.parse(post.ai_explanation); } catch { /* fall through */ }
    }
    if (post.caption?.includes('---')) {
      const lines = post.caption.split('\n');
      const meta: Record<string, string> = {};
      for (const line of lines) {
        const m = line.match(/^(Tipo|Cantidad|Urgencia|Fecha|Notas):\s*(.+)/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim();
      }
      return {
        content_type: meta.tipo ?? null,
        quantity: meta.cantidad ? parseInt(meta.cantidad) : null,
        urgency: meta.urgencia ?? null,
        preferred_date: meta.fecha ?? null,
        extra_notes: meta.notas ?? null,
        media_urls: [] as string[],
      };
    }
    return null;
  })();

  const cleanCaption = post.status === 'request' && post.caption?.includes('---')
    ? post.caption.split('---')[0].trim()
    : post.caption;

  const CONTENT_TYPE_LABELS: Record<string, string> = {
    promocion: 'Promoción', educativo: 'Educativo', branding: 'Branding',
    testimonio: 'Testimonio', otro: 'Otro',
  };

  const STATUS_LABEL: Record<string, string> = {
    request: 'En preparación', draft: 'En preparación', generated: 'Para revisar',
    pending: 'Para revisar', approved: 'Para revisar', scheduled: 'Programado',
    published: 'Publicado', failed: 'Fallido', cancelled: 'Cancelado',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6,
  };

  async function changeRequestStatus(newStatus: string) {
    if (!post) return;

    // Handle regeneration separately — enforce quota limits
    if (newStatus === 'regenerate') {
      // Step 1: check if allowed
      const checkRes  = await fetch(`/api/posts/${post.id}/can-regenerate`);
      const check     = await checkRes.json() as { allowed: boolean; willCostQuota: boolean; quotaAfter?: number; regenerationCount: number; reason?: string; upgradeUrl?: string };
      setRegenCheck(check);

      if (!check.allowed) {
        toast.error(check.reason ?? 'Has alcanzado el límite de tu plan');
        return;
      }

      // Step 2: if it costs quota, require confirmation first
      if (check.willCostQuota && !regenConfirm) {
        setRegenConfirm(true);
        return;
      }

      // Step 3: proceed
      setRegenConfirm(false);
      setRegenerating(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/regenerate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'full' }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.limitReached) {
            toast.error(json.error ?? 'Has alcanzado el límite de tu plan');
          } else {
            toast.error(json.error ?? 'Error al regenerar');
          }
          return;
        }
        updatePost(post.id, json.post);
        setPost(json.post);
        setRegenCheck(null);
        // Refresh quota
        fetch('/api/quota').then((r) => r.json()).then((q) => { if (!q.error) setQuota(q); }).catch(() => {});
        toast.success('Contenido regenerado correctamente');
      } catch { toast.error('Error al regenerar'); }
      finally { setRegenerating(false); }
      return;
    }

    const body: Record<string, unknown> = { status: newStatus };
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error('Error al cambiar estado'); return; }
    const json = await res.json();
    updatePost(post.id, json.post);
    setPost(json.post);
    toast.success(`Estado cambiado`);
  }

  async function deleteRequest() {
    if (!post) return;
    setDeleting(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Error al eliminar'); setDeleting(false); return; }
    removePost(post.id);
    toast.success('Post eliminado');
    router.push('/posts');
  }

  // Parse metadata — must come before STATUS_BANNER so originalImages is available.
  const postMeta = post.ai_explanation
    ? (() => { try { return JSON.parse(post.ai_explanation); } catch { return null; } })()
    : null;

  // Merge requestMeta and postMeta
  const meta = requestMeta ?? postMeta;

  // Original images to show alongside the worker's version in 'pending' state.
  const originalImages: string[] = (() => {
    if (post.status !== 'pending' || !meta) return [];
    const urls: string[] = [];
    if (meta.original_image_url) urls.push(meta.original_image_url);
    if (Array.isArray(meta.per_image)) {
      for (const p of meta.per_image) {
        if (p.media_url && !urls.includes(p.media_url)) urls.push(p.media_url);
      }
    }
    if (Array.isArray(meta.media_urls)) {
      for (const u of meta.media_urls) {
        if (u && !urls.includes(u)) urls.push(u);
      }
    }
    return urls.filter(u => u !== post.image_url);
  })();

  // ── Unified layout for ALL states ──
  const STATUS_BANNER: Record<string, { bg: string; border: string; icon: string; title: string; subtitle: string }> = {
    request:   { bg: 'var(--accent-soft)', border: 'var(--accent)', icon: '✦', title: 'En preparación', subtitle: 'Nuestro equipo está preparando tu contenido. Te avisaremos cuando esté listo.' },
    draft:     { bg: 'var(--bg-1)', border: 'var(--border-dark)', icon: '✎', title: 'Para revisar', subtitle: 'Revisa la propuesta. Si no te convence, devuélvelo a En preparación.' },
    generated: { bg: 'var(--accent-soft)', border: 'var(--accent)', icon: '✦', title: 'Generado por IA', subtitle: 'Revisa el contenido y apruébalo o modifícalo' },
    pending:   { bg: 'var(--bg-1)', border: 'var(--border-dark)', icon: '✎', title: 'Propuesta lista para revisar', subtitle: postMeta?.worker_notes ? String(postMeta.worker_notes) : originalImages.length > 0 ? 'Tu equipo ha procesado el contenido. Compara la versión original con la propuesta y decide.' : 'Tu equipo ha preparado esta propuesta. Acéptala o pide una nueva versión.' },
    approved:  { bg: 'var(--accent-soft)', border: 'var(--accent)', icon: '✓', title: 'Aprobado', subtitle: 'Listo para programar o publicar' },
    scheduled: { bg: 'var(--accent-soft)', border: 'var(--accent)', icon: '◷', title: 'Programado', subtitle: post.scheduled_at ? `Se publicará el ${new Date(post.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Fecha pendiente' },
    published: { bg: 'var(--accent-soft)', border: 'var(--accent)', icon: '✓', title: 'Publicado', subtitle: post.published_at ? `Publicado el ${new Date(post.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Publicación completada' },
    failed:    { bg: '#fef2f2', border: '#991b1b', icon: '!', title: 'Error de publicación', subtitle: 'Hubo un problema al publicar. Inténtalo de nuevo' },
    cancelled: { bg: 'var(--bg-1)', border: 'var(--border)', icon: '✕', title: 'Cancelado', subtitle: 'Esta publicación fue descartada' },
  };

  const banner = STATUS_BANNER[post.status] ?? STATUS_BANNER.draft;

  const inputBase: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid var(--border)',
    fontFamily: f, fontSize: 13, color: 'var(--text-primary)', outline: 'none',
  };

  // Status-specific actions
  const STATUS_ACTIONS: { status: string; label: string; bg: string; color: string; border: string }[] = (() => {
    switch (post.status) {
      case 'request':
        return [
          { status: 'pending', label: 'Pasar a Pendiente (validar)', bg: 'var(--bg)', color: '#111827', border: 'var(--border-dark)' },
        ];
      case 'draft':
        return [
          { status: 'request', label: 'Devolver a En preparación', bg: 'var(--bg)', color: 'var(--text-secondary)', border: 'var(--border)' },
          { status: 'regenerate', label: 'Regenerar propuesta', bg: 'var(--accent)', color: '#fff', border: 'var(--accent)' },
          { status: 'published', label: 'Publicar ahora', bg: '#111827', color: '#fff', border: '#111827' },
        ];
      case 'pending':
        // from_worker → client reviews worker proposal: Accept / Request new version
        if (postMeta?.from_worker) {
          return [
            { status: 'request', label: 'Pedir nueva versión', bg: 'var(--bg)', color: 'var(--text-secondary)', border: 'var(--border)' },
            { status: 'approved', label: '✓ Aceptar propuesta', bg: '#0D9488', color: '#fff', border: '#0D9488' },
          ];
        }
        return [
          { status: 'regenerate', label: 'Regenerar propuesta', bg: 'var(--accent)', color: '#fff', border: 'var(--accent)' },
        ];
      case 'generated':
        return [
          { status: 'pending', label: 'Enviar a revisión', bg: 'var(--bg)', color: '#111827', border: 'var(--border-dark)' },
          { status: 'regenerate', label: 'Regenerar propuesta', bg: 'var(--accent)', color: '#fff', border: 'var(--accent)' },
          { status: 'published', label: 'Publicar ahora', bg: '#111827', color: '#fff', border: '#111827' },
        ];
      case 'approved':
        return [
          { status: 'published', label: 'Publicar ahora', bg: '#111827', color: '#fff', border: '#111827' },
        ];
      case 'scheduled':
        return [
          { status: 'pending', label: 'Volver a revisión', bg: 'var(--bg)', color: 'var(--text-secondary)', border: 'var(--border)' },
          { status: 'published', label: 'Publicar ahora', bg: '#111827', color: '#fff', border: '#111827' },
        ];
      case 'failed':
        return [
          { status: 'pending', label: 'Mover a Pendiente', bg: 'var(--bg)', color: '#111827', border: 'var(--border-dark)' },
          { status: 'published', label: 'Reintentar publicación', bg: '#111827', color: '#fff', border: '#111827' },
        ];
      default: return [];
    }
  })();

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <div style={{ padding: '32px 0 0' }}>
        <Link href="/posts" className="back-link">
          <ArrowLeft size={16} /> Volver a Posts
        </Link>
      </div>

      {/* Status banner */}
      <div style={{
        background: banner.bg, border: `1px solid ${banner.border}`,
        padding: '16px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, background: banner.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}>{banner.icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 2 }}>
            {banner.title}
          </p>
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)' }}>
            {banner.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setEditCaption(!editCaption)} style={{
            padding: '7px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
            fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-primary)',
          }}>
            <Edit2 size={12} /> Editar
          </button>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>¿Seguro?</span>
              <button onClick={deleteRequest} disabled={deleting} style={{
                padding: '7px 14px', background: '#dc2626', border: '1px solid #dc2626',
                fontFamily: f, fontSize: 12, fontWeight: 600, cursor: deleting ? 'wait' : 'pointer',
                color: '#fff',
              }}>
                {deleting ? 'Eliminando…' : 'Sí, borrar'}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '7px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
                fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)',
              }}>
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              padding: '7px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
              fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, color: 'var(--error)',
            }}>
              <Trash2 size={12} /> Eliminar
            </button>
          )}
        </div>
      </div>

      {/* ── Hero media (full width) ── */}
      {(() => {
        // Semantic: edited_image_url = AI result; image_url = original client upload.
        // Display the best available image; show comparison when both differ.
        const heroUrl  = post.edited_image_url ?? post.image_url;
        const origUrl  = (post.edited_image_url && post.image_url && post.edited_image_url !== post.image_url)
          ? post.image_url : null;
        if (!heroUrl) return null;
        const isVideo  = (u: string) => /\.(mp4|mov|webm|avi)(\?|$)/i.test(u);
        return (
          <div style={{ marginBottom: 16 }}>
            {(originalImages.length > 0 || origUrl) && (
              <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
                Propuesta del equipo
              </p>
            )}

            {/* Main hero — shows edited_image_url when available, else image_url */}
            <div style={{ background: '#000', border: '1px solid var(--border)' }}>
              {isVideo(heroUrl) ? (
                <video src={heroUrl} controls style={{ width: '100%', maxHeight: 640, objectFit: 'contain', display: 'block' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroUrl} alt="" style={{ width: '100%', maxHeight: 640, objectFit: 'contain', display: 'block', imageOrientation: 'from-image' }} />
              )}
            </div>

            {/* AI asset alternatives (switch between generated versions) */}
            <AssetVersions
              postId={post.id}
              currentImageUrl={heroUrl}
              onImageChange={(url) => {
                setPost(p => p ? { ...p, edited_image_url: url } : p);
                updatePost(post.id, { edited_image_url: url });
              }}
              onApprove={async () => {
                const res = await fetch(`/api/posts/${post.id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'pending' }),
                });
                if (res.ok) {
                  const json = await res.json();
                  updatePost(post.id, json.post);
                  setPost(json.post);
                }
              }}
              onReject={(action) => {
                if (action === 'delete') {
                  deleteRequest();
                } else {
                  changeRequestStatus('request');
                }
              }}
            />

            {/* Comparison: original client upload vs AI result (when both exist) */}
            {origUrl && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    Tu imagen original
                  </p>
                  <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {isVideo(origUrl) ? (
                      <video src={origUrl} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={origUrl} alt="Original" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
                    )}
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>
                    Versión generada
                  </p>
                  <div style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {isVideo(heroUrl) ? (
                      <video src={heroUrl} style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroUrl} alt="Versión generada" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Brief reference images (from ai_explanation metadata, separate from above) */}
            {originalImages.length > 0 && !origUrl && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  Tu imagen original
                </p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {originalImages.map((url, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      {isVideo(url) ? (
                        <video src={url} style={{ width: 160, height: 160, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`Original ${i + 1}`} style={{ width: 160, height: 160, objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Content + actions panel (full width) ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="post-detail-panel" style={{ border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Solicitud original (only for posts that came from a request) */}
        {meta && post.status !== 'request' && (cleanCaption !== post.caption) && (
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
            <p style={labelStyle}>Solicitud original</p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {cleanCaption}
            </p>
          </div>
        )}

        {/* Propuesta de descripción */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={labelStyle}>Propuesta de descripción</p>
            {!editCaption && post.caption && (
              <button onClick={() => setEditCaption(true)} style={{
                padding: '4px 10px', background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--accent)',
              }}>
                Modificar
              </button>
            )}
          </div>
          {editCaption ? (
            <div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                placeholder="Escribe la descripción del post..."
                style={{
                  width: '100%', padding: '12px 14px', border: '1px solid var(--border)',
                  fontFamily: f, fontSize: 14, color: 'var(--text-primary)', resize: 'vertical',
                  outline: 'none', lineHeight: 1.7, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={saveCaption} style={{
                  padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none',
                  fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', cursor: 'pointer',
                }}>
                  Guardar
                </button>
                <button onClick={() => { setEditCaption(false); setCaption(post.caption ?? ''); }} style={{
                  padding: '8px 16px', background: 'var(--bg)', border: '1px solid var(--border)',
                  fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)',
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : post.caption ? (
            <p style={{ fontFamily: f, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {post.caption}
            </p>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 10 }}>
                Aún no hay descripción. Puedes añadir la tuya o esperar nuestra propuesta.
              </p>
              <button onClick={() => setEditCaption(true)} style={{
                padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none',
                fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                Escribir descripción
              </button>
            </div>
          )}
        </div>

        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)' }}>
            <p style={labelStyle}>Hashtags</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {post.hashtags.map((h) => (
                <span key={h} style={{
                  padding: '3px 10px', background: 'var(--accent-soft)', color: 'var(--accent)',
                  fontFamily: f, fontSize: 12, fontWeight: 500,
                }}>
                  #{h.replace(/^#/, '')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Parameters grid */}
        <div className="post-detail-params" style={{
          padding: '20px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', gap: '16px 32px', alignItems: 'flex-start',
        }}>
          <div>
            <p style={labelStyle}>Estado</p>
            <span className={`status-badge status-${post.status}`}>{STATUS_LABEL[post.status] ?? post.status}</span>
          </div>
          <div>
            <p style={labelStyle}>Plataforma</p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
              {Array.isArray(post.platform) ? post.platform.join(', ') : post.platform}
            </p>
          </div>
          <div>
            <p style={labelStyle}>Formato</p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
              {post.format}
            </p>
          </div>
          {meta?.content_type && (
            <div>
              <p style={labelStyle}>Tipo</p>
              <div style={{
                display: 'inline-flex', padding: '4px 10px',
                background: 'var(--bg-1)', border: '1px solid var(--border-dark)',
                fontFamily: f, fontSize: 12, fontWeight: 600, color: '#111827',
              }}>
                {CONTENT_TYPE_LABELS[meta.content_type] ?? meta.content_type}
              </div>
            </div>
          )}
          {meta?.urgency && (
            <div>
              <p style={labelStyle}>Urgencia</p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                background: meta.urgency === 'urgente' ? '#111827' : 'var(--bg-1)',
                border: `1px solid ${meta.urgency === 'urgente' ? '#111827' : 'var(--border)'}`,
                fontFamily: f, fontSize: 12, fontWeight: 600,
                color: meta.urgency === 'urgente' ? '#fff' : 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}>
                {meta.urgency}
              </div>
            </div>
          )}
        </div>

        {/* Schedule date+time picker */}
        {post.status !== 'published' && post.status !== 'cancelled' && post.status !== 'request' && (
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
            <p style={labelStyle}>Fecha y hora de publicación</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={inputBase} />
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={inputBase} />
              {scheduleDate && post.status !== 'scheduled' && (
                <button onClick={async () => {
                  const dt = new Date(`${scheduleDate}T${scheduleTime || '10:00'}:00`).toISOString();
                  const res = await fetch(`/api/posts/${post.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scheduled_at: dt, status: 'scheduled' }),
                  });
                  const json = await res.json();
                  if (res.ok && json.post) {
                    updatePost(post.id, json.post);
                    setPost(json.post);
                    toast.success('Publicación programada');
                  } else {
                    toast.error('Error al programar');
                  }
                }} style={{
                  padding: '8px 20px', background: '#111827', color: '#fff',
                  borderTop: '1px solid #111827', borderBottom: '1px solid #111827',
                  borderLeft: '1px solid #111827', borderRight: '1px solid #111827',
                  fontFamily: fc, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Programar publicación
                </button>
              )}
              {scheduleDate && post.status === 'scheduled' && (
                <button onClick={async () => {
                  const dt = new Date(`${scheduleDate}T${scheduleTime || '10:00'}:00`).toISOString();
                  const res = await fetch(`/api/posts/${post.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scheduled_at: dt }),
                  });
                  const json = await res.json();
                  if (res.ok && json.post) {
                    updatePost(post.id, json.post);
                    setPost(json.post);
                    toast.success('Fecha actualizada');
                  }
                }} style={{
                  padding: '8px 20px', background: 'var(--bg)', color: '#111827',
                  borderTop: '1px solid var(--border-dark)', borderBottom: '1px solid var(--border-dark)',
                  borderLeft: '1px solid var(--border-dark)', borderRight: '1px solid var(--border-dark)',
                  fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Actualizar fecha
                </button>
              )}
            </div>
            {post.scheduled_at && post.status === 'scheduled' && (
              <p style={{ fontFamily: f, fontSize: 12, color: 'var(--accent)', marginTop: 10, fontWeight: 500 }}>
                Se publicará el {new Date(post.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Weekly quota bar */}
        {quota && (
          <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
              <p style={{ ...labelStyle, margin: 0 }}>
                Cuota semanal — plan {quota.plan.charAt(0).toUpperCase() + quota.plan.slice(1)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Photo posts bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>Posts de foto</span>
                  <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, color: quota.photoPostsRemaining === 0 ? '#dc2626' : 'var(--accent)' }}>
                    {quota.photoPostsRemaining} / {quota.photoPostsLimit} restantes
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', position: 'relative' }}>
                  <div style={{
                    height: '100%', background: quota.photoPostsRemaining === 0 ? '#dc2626' : 'var(--accent)',
                    width: `${Math.min(100, ((quota.photoPostsLimit - quota.photoPostsRemaining) / quota.photoPostsLimit) * 100)}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
              {/* Video posts bar (only if plan allows) */}
              {quota.videoPostsLimit > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>Vídeos / Reels</span>
                    <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, color: quota.videoPostsRemaining === 0 ? '#dc2626' : 'var(--accent)' }}>
                      {quota.videoPostsRemaining} / {quota.videoPostsLimit} restantes
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', position: 'relative' }}>
                    <div style={{
                      height: '100%', background: quota.videoPostsRemaining === 0 ? '#dc2626' : 'var(--accent)',
                      width: `${Math.min(100, ((quota.videoPostsLimit - quota.videoPostsRemaining) / quota.videoPostsLimit) * 100)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TikTok manual publish helper */}
        {Array.isArray(post.platform) && post.platform.includes('tiktok') && (post.format === 'video' || post.format === 'reel') && (post.video_url || post.image_url) && (
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
            <TikTokDownload
              videoUrl={post.video_url ?? post.image_url!}
              caption={post.caption}
              hashtags={post.hashtags}
              postId={post.id}
            />
          </div>
        )}

        {/* Status actions */}
        {STATUS_ACTIONS.length > 0 && (
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
            <p style={labelStyle}>Acciones</p>

            {/* Regeneration blocked — no quota */}
            {regenCheck && !regenCheck.allowed && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 16px', marginBottom: 12,
              }}>
                <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontFamily: f, fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                    Límite semanal alcanzado
                  </p>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {regenCheck.reason}
                  </p>
                  {regenCheck.upgradeUrl && (
                    <a href={regenCheck.upgradeUrl} style={{ fontFamily: f, fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 6, display: 'inline-block' }}>
                      Actualizar plan →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Regeneration confirmation — will cost quota */}
            {regenConfirm && regenCheck?.willCostQuota && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: '#fffbeb', border: '1px solid #fbbf24', padding: '12px 16px', marginBottom: 12,
              }}>
                <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: f, fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Esta regeneración consume 1 post de tu cuota
                  </p>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 10 }}>
                    Ya has usado las 3 regeneraciones gratuitas de este post. Continuar descontará 1 post de tu cupo semanal
                    {regenCheck.quotaAfter !== undefined ? ` (te quedarán ${regenCheck.quotaAfter} posts esta semana)` : ''}.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => changeRequestStatus('regenerate')} disabled={regenerating} style={{
                      padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none',
                      fontFamily: f, fontSize: 12, fontWeight: 700, cursor: regenerating ? 'wait' : 'pointer',
                      opacity: regenerating ? 0.6 : 1,
                    }}>
                      {regenerating ? 'Regenerando…' : 'Sí, continuar'}
                    </button>
                    <button type="button" onClick={() => { setRegenConfirm(false); setRegenCheck(null); }} style={{
                      padding: '7px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
                      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)',
                    }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_ACTIONS.filter(a => a.status !== 'scheduled').map(({ status, label, bg, color, border }) => (
                <button key={status} onClick={() => changeRequestStatus(status)}
                  disabled={status === 'regenerate' && regenerating}
                  style={{
                    padding: '8px 18px', background: bg, color,
                    borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
                    borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}`,
                    fontFamily: f, fontSize: 12, fontWeight: 600,
                    cursor: (status === 'regenerate' && regenerating) ? 'wait' : 'pointer',
                    opacity: (status === 'regenerate' && regenerating) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  {status === 'regenerate' && regenerating
                    ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Regenerando…</>
                    : label
                  }
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extra notes */}
        {meta?.extra_notes && (
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
            <p style={labelStyle}>Notas adicionales</p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{meta.extra_notes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 28px', background: 'var(--bg-1)',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        }}>
          <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
            Creado el {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        </div>
      </div>

      {/* ── Version history — full width, below the panel ── */}
      {Array.isArray(post.versions) && post.versions.length > 0 && (
        <VersionsPanel
          versions={post.versions}
          currentCaption={post.caption}
          currentImageUrl={post.image_url}
          onRevert={handleRevertVersion}
        />
      )}
    </div>
  );
}