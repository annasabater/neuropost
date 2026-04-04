'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Check } from 'lucide-react';
import { ProspectStatusBadge } from '@/components/admin/ProspectStatusBadge';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db', green: '#4ade80' };

const STATUSES = ['contacted', 'replied', 'interested', 'converted', 'not_interested'] as const;

interface Prospect {
  id: string; username: string | null; full_name: string | null; profile_pic_url: string | null;
  bio: string | null; followers: number; following: number; post_count: number;
  sector: string | null; city: string | null; email: string | null; website: string | null;
  channel: string; status: string; notes: string | null; last_activity: string;
}
interface Interaction { id: string; type: string; content: string | null; created_at: string; metadata: Record<string, unknown> }
interface Comment { id: string; content: string; prospect_reply: string | null; status: string; sent_at: string }
interface Message { id: string; content: string | null; our_reply: string | null; status: string; created_at: string }

const TYPE_ICON: Record<string, string> = {
  comment_sent: '💬', comment_reply_received: '↩️', dm_received: '📩', dm_sent: '📤',
  email_sent: '✉️', email_replied: '📧', status_changed: '🔄', note_added: '📝', ad_lead: '📣',
};

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ProspectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [prospect,     setProspect]     = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [comments,     setComments]     = useState<Comment[]>([]);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [editStatus,  setEditStatus]  = useState('');
  const [editNotes,   setEditNotes]   = useState('');
  const [editSector,  setEditSector]  = useState('');
  const [editEmail,   setEditEmail]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [converting,  setConverting]  = useState(false);

  useEffect(() => {
    fetch(`/api/admin/prospects/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.prospect) {
          setProspect(data.prospect);
          setEditStatus(data.prospect.status);
          setEditNotes(data.prospect.notes ?? '');
          setEditSector(data.prospect.sector ?? '');
          setEditEmail(data.prospect.email ?? '');
        }
        setInteractions(data.interactions ?? []);
        setComments(data.comments ?? []);
        setMessages(data.messages ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!prospect) return;
    setSaving(true);
    const res = await fetch(`/api/admin/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus, notes: editNotes || undefined, sector: editSector || undefined, email: editEmail || undefined }),
    });
    const data = await res.json() as { prospect: Prospect };
    if (data.prospect) {
      setProspect(data.prospect);
      setEditStatus(data.prospect.status);
    }
    setSaving(false);
    // Refresh interactions
    fetch(`/api/admin/prospects/${id}`).then(r => r.json()).then(d => setInteractions(d.interactions ?? []));
  }

  async function handleConvert() {
    if (!prospect) return;
    setConverting(true);
    await fetch(`/api/admin/prospects/${id}/convert`, { method: 'POST' });
    setProspect(p => p ? { ...p, status: 'converted' } : p);
    setEditStatus('converted');
    setConverting(false);
  }

  if (loading) return <div style={{ padding: 40, color: A.muted, fontSize: 14 }}>Cargando...</div>;
  if (!prospect) return <div style={{ padding: 40, color: '#f87171', fontSize: 14 }}>Prospect no encontrado.</div>;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, padding: '7px 10px', color: A.muted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={14} />
        </button>
        {prospect.profile_pic_url ? (
          <img src={prospect.profile_pic_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: A.border }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: A.text, margin: 0 }}>@{prospect.username ?? '—'}</h1>
            <ProspectStatusBadge status={prospect.status as never} />
          </div>
          {prospect.full_name && <p style={{ fontSize: 13, color: A.muted, margin: '2px 0 0' }}>{prospect.full_name}</p>}
        </div>
        {prospect.status !== 'converted' && (
          <button
            onClick={handleConvert}
            disabled={converting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: A.green, color: '#000', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: converting ? 'not-allowed' : 'pointer', opacity: converting ? 0.6 : 1 }}
          >
            <Check size={14} /> {converting ? 'Convirtiendo...' : 'Marcar como cliente'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: profile + edit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats */}
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Perfil</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[['Seguidores', prospect.followers], ['Siguiendo', prospect.following], ['Posts', prospect.post_count]].map(([l, v]) => (
                <div key={String(l)} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: A.text }}>{Number(v).toLocaleString('es-ES')}</div>
                  <div style={{ fontSize: 11, color: A.muted }}>{l}</div>
                </div>
              ))}
            </div>
            {prospect.bio && <p style={{ fontSize: 12, color: A.muted, margin: 0, lineHeight: 1.5 }}>{prospect.bio}</p>}
            {prospect.website && (
              <a href={prospect.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: A.orange, marginTop: 8 }}>
                <ExternalLink size={11} /> {prospect.website}
              </a>
            )}
          </div>

          {/* Edit form */}
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Editar</h3>
            {[
              { label: 'Estado', el: (
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, color: A.text, fontSize: 13, padding: '8px 10px', outline: 'none' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )},
              { label: 'Sector', el: <input value={editSector} onChange={e => setEditSector(e.target.value)} style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, color: A.text, fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' as const }} /> },
              { label: 'Email', el: <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, color: A.text, fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' as const }} /> },
              { label: 'Notas', el: <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, color: A.text, fontSize: 13, padding: '8px 10px', outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: A.muted, marginBottom: 4 }}>{label}</label>
                {el}
              </div>
            ))}
            <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: A.orange, border: 'none', borderRadius: 8, color: '#fff', padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, marginTop: 4 }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* Right: timeline + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Timeline */}
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>Historial ({interactions.length})</h3>
            {interactions.length === 0 && <p style={{ color: A.muted, fontSize: 13 }}>Sin actividad todavía.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {interactions.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, background: '#0f0e0c' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{TYPE_ICON[item.type] ?? '•'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: A.orange, fontWeight: 600 }}>{item.type.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 11, color: A.muted, flexShrink: 0 }}>{timeStr(item.created_at)}</span>
                    </div>
                    {item.content && <p style={{ fontSize: 12, color: A.text, margin: '3px 0 0', lineHeight: 1.5 }}>{item.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Comentarios ({comments.length})</h3>
              {comments.map((c) => (
                <div key={c.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#0f0e0c', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: A.muted, margin: '0 0 4px' }}>Nosotros: <span style={{ color: A.text }}>{c.content}</span></p>
                  {c.prospect_reply && <p style={{ fontSize: 12, color: A.muted, margin: '4px 0 0' }}>Respuesta: <span style={{ color: A.green }}>{c.prospect_reply}</span></p>}
                  <p style={{ fontSize: 10, color: A.muted, margin: '4px 0 0' }}>{timeStr(c.sent_at)} · {c.status}</p>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Mensajes ({messages.length})</h3>
              {messages.map((m) => (
                <div key={m.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#0f0e0c', marginBottom: 8 }}>
                  {m.content && <p style={{ fontSize: 12, color: A.text, margin: '0 0 4px' }}>{m.content}</p>}
                  {m.our_reply && <p style={{ fontSize: 12, color: A.muted, margin: '4px 0 0' }}>Respuesta: <span style={{ color: A.green }}>{m.our_reply}</span></p>}
                  <p style={{ fontSize: 10, color: A.muted, margin: '4px 0 0' }}>{timeStr(m.created_at)} · {m.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
