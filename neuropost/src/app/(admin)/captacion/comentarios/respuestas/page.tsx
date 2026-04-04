'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ThumbsUp, Send, Sparkles } from 'lucide-react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db', green: '#4ade80' };

interface Comment {
  id: string; content: string; prospect_reply: string | null; prospect_reply_liked: boolean;
  status: string; sent_at: string; ig_post_url: string | null;
  prospects?: { username: string; full_name: string | null; profile_pic_url: string | null };
  prospect_id: string | null;
}

const STATUS_OPTS = ['', 'sent', 'replied', 'replied_by_us', 'ignored'];

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ComentariosRespuestasPage() {
  const [comments,  setComments]  = useState<Comment[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('replied'); // default: show ones with replies
  const [selected,  setSelected]  = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending,   setSending]   = useState(false);
  const [liking,    setLiking]    = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const res  = await fetch(`/api/admin/comentarios/respuestas?${params}`);
    const data = await res.json() as { comments: Comment[]; total: number };
    setComments(data.comments ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    await fetch('/api/admin/comentarios/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: selected.id, text: replyText.trim() }),
    });
    setSending(false);
    setReplyText('');
    setSelected(null);
    load();
  }

  async function handleLike(commentId: string) {
    setLiking(true);
    await fetch('/api/admin/comentarios/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    setLiking(false);
    load();
  }

  async function handleAiSuggest() {
    if (!selected) return;
    setSuggesting(true);
    const context = [
      `Usuario: @${selected.prospects?.username ?? 'desconocido'}`,
      `Comentario enviado: ${selected.content}`,
      selected.prospect_reply ? `Respuesta del prospect: ${selected.prospect_reply}` : '',
    ].filter(Boolean).join('\n');
    const res  = await fetch('/api/admin/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, platform: 'comment', lastMessage: selected.prospect_reply }),
    });
    const data = await res.json() as { suggestion: string };
    if (data.suggestion) setReplyText(data.suggestion);
    setSuggesting(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left panel: list */}
      <div style={{ width: 380, borderRight: `1px solid ${A.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${A.border}` }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: A.text, margin: '0 0 12px' }}>Comentarios ({total})</h1>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 7, color: A.text, fontSize: 12, padding: '7px 10px', outline: 'none' }}
          >
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'Todos los estados'}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 20, color: A.muted, fontSize: 13 }}>Cargando...</div>}
          {!loading && comments.map(c => (
            <div
              key={c.id}
              onClick={() => { setSelected(c); setReplyText(''); }}
              style={{
                padding: '14px 18px', borderBottom: `1px solid ${A.border}`, cursor: 'pointer',
                background: selected?.id === c.id ? '#22201e' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {c.prospects?.profile_pic_url ? (
                  <img src={c.prospects.profile_pic_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: A.border }} />
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: A.text }}>@{c.prospects?.username ?? '—'}</div>
                  <div style={{ fontSize: 10, color: A.muted }}>{timeStr(c.sent_at)}</div>
                </div>
                {c.prospect_reply && !c.prospect_reply_liked && (
                  <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: A.orange }} />
                )}
              </div>
              <p style={{ fontSize: 12, color: A.muted, margin: '0 0 4px', lineHeight: 1.4 }}>💬 {c.content}</p>
              {c.prospect_reply && (
                <p style={{ fontSize: 12, color: A.text, margin: 0, lineHeight: 1.4 }}>↩️ {c.prospect_reply}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: detail + reply */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            {selected.prospects?.profile_pic_url ? (
              <img src={selected.prospects.profile_pic_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: A.border }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: A.text }}>@{selected.prospects?.username ?? '—'}</div>
              {selected.prospects?.full_name && <div style={{ fontSize: 12, color: A.muted }}>{selected.prospects.full_name}</div>}
            </div>
            {selected.prospect_id && (
              <Link href={`/captacion/prospects/${selected.prospect_id}`} style={{ fontSize: 12, color: A.orange, textDecoration: 'none' }}>Ver perfil →</Link>
            )}
          </div>

          {/* Thread */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Our comment */}
            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
              <div style={{ maxWidth: '70%', background: 'rgba(255,107,53,0.18)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: A.muted, margin: '0 0 4px' }}>Tu comentario</p>
                <p style={{ fontSize: 13, color: A.text, margin: 0, lineHeight: 1.5 }}>{selected.content}</p>
                <p style={{ fontSize: 10, color: '#555', margin: '4px 0 0' }}>{timeStr(selected.sent_at)}</p>
                {selected.ig_post_url && (
                  <a href={selected.ig_post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: A.orange, display: 'block', marginTop: 4 }}>Ver post ↗</a>
                )}
              </div>
            </div>

            {/* Their reply */}
            {selected.prospect_reply && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                <div style={{ maxWidth: '70%', background: A.card, borderRadius: '14px 14px 14px 4px', padding: '10px 14px', position: 'relative' }}>
                  <p style={{ fontSize: 10, color: A.orange, fontWeight: 700, margin: '0 0 4px' }}>@{selected.prospects?.username}</p>
                  <p style={{ fontSize: 13, color: A.text, margin: 0, lineHeight: 1.5 }}>{selected.prospect_reply}</p>
                  {!selected.prospect_reply_liked && (
                    <button
                      onClick={() => handleLike(selected.id)}
                      disabled={liking}
                      style={{ position: 'absolute', bottom: -10, right: 8, background: A.bg, border: `1px solid ${A.border}`, borderRadius: 20, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      <ThumbsUp size={10} /> Like
                    </button>
                  )}
                  {selected.prospect_reply_liked && (
                    <span style={{ position: 'absolute', bottom: -10, right: 8, background: '#2a4a2a', border: `1px solid ${A.green}`, borderRadius: 20, padding: '2px 7px', fontSize: 11, color: A.green }}>
                      ✓ Me gusta
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reply box */}
          <div style={{ borderTop: `1px solid ${A.border}`, padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                onClick={handleAiSuggest}
                disabled={suggesting}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,107,53,0.1)', border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 7, padding: '6px 12px', color: A.orange, fontSize: 12, cursor: suggesting ? 'not-allowed' : 'pointer', opacity: suggesting ? 0.6 : 1 }}
              >
                <Sparkles size={12} /> {suggesting ? 'Generando...' : 'Sugerir con IA'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Responder al comentario..."
                rows={3}
                style={{ flex: 1, background: '#1a1917', border: `1px solid ${A.border}`, borderRadius: 8, color: A.text, fontSize: 13, padding: '10px 12px', resize: 'none', outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(); }}
              />
              <button
                onClick={handleReply}
                disabled={sending || !replyText.trim()}
                style={{ padding: '0 16px', borderRadius: 8, background: sending || !replyText.trim() ? A.border : A.orange, color: sending || !replyText.trim() ? A.muted : '#fff', border: 'none', cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
              >
                <Send size={13} /> {sending ? '...' : 'Enviar'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>⌘ + Enter para enviar</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: A.muted, fontSize: 14 }}>
          Selecciona un comentario para responder
        </div>
      )}
    </div>
  );
}
