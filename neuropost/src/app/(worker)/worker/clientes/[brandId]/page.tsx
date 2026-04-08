'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

type Brand = Record<string, unknown> & { id: string; name: string; plan: string; ig_username?: string };
type Post   = Record<string, unknown> & { id: string; image_url?: string; status: string; created_at: string };
type Note   = { id: string; note: string; is_pinned: boolean; created_at: string; workers?: { full_name: string } };
type Activity = { id: string; action: string; details: Record<string, unknown> | null; created_at: string };

const TABS = ['Resumen', 'Contenido', 'Actividad', 'Notas'];

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function ClientProfilePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = use(params);
  const router = useRouter();

  const [brand, setBrand]       = useState<Brand | null>(null);
  const [posts, setPosts]       = useState<Post[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notes, setNotes]       = useState<Note[]>([]);
  const [tab, setTab]           = useState(0);
  const [newNote, setNewNote]   = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`/api/worker/clientes/${brandId}`).then((r) => r.json()).then((d) => {
      if (!d.brand) { router.push('/worker/clientes'); return; }
      setBrand(d.brand);
      setPosts(d.posts ?? []);
      setActivity(d.activity ?? []);
      setNotes(d.notes ?? []);
      setLoading(false);
    });
  }, [brandId, router]);

  async function addNote() {
    if (!newNote.trim()) return;
    const res  = await fetch('/api/worker/notas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: brandId, note: newNote }),
    });
    const json = await res.json();
    if (res.ok) { setNotes((prev) => [json.note, ...prev]); setNewNote(''); toast.success('Nota añadida'); }
    else toast.error(json.error ?? 'Error');
  }

  if (loading) return <div style={{ padding: 40, color: W.muted }}>Cargando...</div>;
  if (!brand)  return null;

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/worker/clientes')} style={{ background: 'none', border: 'none', color: W.muted, cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
          ← Todos los clientes
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: W.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>
            {brand.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: W.text }}>{brand.name}</h1>
            <div style={{ fontSize: 13, color: W.muted }}>
              {String(brand.sector ?? '').replace(/_/g, ' ')} · Plan {brand.plan}
              {brand.ig_username && <> · @{brand.ig_username}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${W.border}`, paddingBottom: 0 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? W.blue : W.muted,
            borderBottom: tab === i ? `2px solid ${W.blue}` : '2px solid transparent',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Resumen */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: W.muted, marginBottom: 14 }}>INFO DEL CLIENTE</h3>
            {[
              ['Plan', String(brand.plan)],
              ['Sector', String(brand.sector ?? '—').replace(/_/g, ' ')],
              ['Instagram', brand.ig_username ? `@${brand.ig_username}` : 'No conectado'],
              ['Modo publicación', String(brand.publish_mode ?? '—')],
              ['Alta en NeuroPost', brand.created_at ? new Date(String(brand.created_at)).toLocaleDateString('es-ES') : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${W.border}`, fontSize: 13 }}>
                <span style={{ color: W.muted }}>{label}</span>
                <span style={{ color: W.text, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: W.muted, marginBottom: 14 }}>ESTADO ACTUAL</h3>
            {[
              ['Posts publicados', posts.filter((p) => p.status === 'published').length],
              ['Posts pendientes', posts.filter((p) => p.status === 'pending').length],
              ['Posts aprobados', posts.filter((p) => p.status === 'approved').length],
              ['Total posts', posts.length],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${W.border}`, fontSize: 13 }}>
                <span style={{ color: W.muted }}>{label}</span>
                <span style={{ color: W.text, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
            {!!brand.meta_token_expires_at && new Date(String(brand.meta_token_expires_at)) < new Date(Date.now() + 3 * 86400000) && (
              <div style={{ marginTop: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fca5a5' }}>
                ⚠️ Token de Instagram expira pronto
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Contenido */}
      {tab === 1 && (
        <div>
          {posts.length === 0 ? <p style={{ color: W.muted, fontSize: 13 }}>Sin posts todavía.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {posts.map((post) => (
                <div key={post.id} style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: 120, background: W.border, overflow: 'hidden' }}>
                    {post.image_url && <img src={String(post.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: post.status === 'published' ? '#14B8A6' : post.status === 'failed' ? '#ef4444' : W.muted }}>
                      {post.status}
                    </div>
                    <div style={{ fontSize: 10, color: W.muted, marginTop: 2 }}>{timeAgo(String(post.created_at))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Actividad */}
      {tab === 2 && (
        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20 }}>
          {activity.length === 0 ? <p style={{ color: W.muted, fontSize: 13 }}>Sin actividad registrada.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activity.map((event) => (
                <div key={event.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${W.border}` }}>
                  <div style={{ fontSize: 18 }}>
                    {event.action.includes('published') ? '✅' : event.action.includes('rejected') ? '❌' : event.action.includes('connected') ? '🔑' : event.action.includes('plan') ? '💳' : '📌'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: W.text }}>{event.action.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 11, color: W.muted, marginTop: 2 }}>{timeAgo(event.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Notas */}
      {tab === 3 && (
        <div>
          <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: W.muted, marginBottom: 10 }}>AÑADIR NOTA INTERNA</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Nota interna sobre este cliente (no visible para el cliente)..."
              rows={3}
              style={{ width: '100%', background: '#0f172a', border: `1px solid ${W.border}`, borderRadius: 8, padding: '10px 12px', color: W.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={addNote} style={{ marginTop: 10, padding: '8px 20px', background: W.blue, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Añadir nota
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map((note) => (
              <div key={note.id} style={{ background: W.card, border: `1px solid ${note.is_pinned ? W.blue : W.border}`, borderRadius: 10, padding: '14px 16px' }}>
                {note.is_pinned && <span style={{ fontSize: 10, color: W.blue, fontWeight: 700, marginBottom: 6, display: 'block' }}>📌 FIJADA</span>}
                <div style={{ fontSize: 13, color: W.text, lineHeight: 1.5 }}>{note.note}</div>
                <div style={{ fontSize: 11, color: W.muted, marginTop: 8 }}>
                  {note.workers?.full_name ?? 'Worker'} · {timeAgo(note.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
