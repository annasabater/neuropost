'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Send, Sparkles } from 'lucide-react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db' };

interface Thread {
  id: string; thread_id: string | null; sender_username: string | null;
  sender_id: string | null; content: string | null; status: string;
  created_at: string; prospect_id: string | null;
  prospects?: { username: string | null; full_name: string | null; email: string | null };
}
interface Message {
  id: string; sender_username: string | null; sender_id: string | null;
  content: string | null; our_reply: string | null; status: string; created_at: string;
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EmailRespuestasPage() {
  const [threads,      setThreads]      = useState<Thread[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Thread | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [replyText,    setReplyText]    = useState('');
  const [sending,      setSending]      = useState(false);
  const [suggesting,   setSuggesting]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res  = await fetch(`/api/admin/email/respuestas?${params}`);
    const data = await res.json() as { threads: Thread[]; total: number };
    setThreads(data.threads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  async function selectThread(t: Thread) {
    setSelected(t);
    setReplyText('');
    setLoadingMsgs(true);
    const key = t.thread_id ?? t.id;
    const res  = await fetch(`/api/admin/mensajes/${key}`);
    const data = await res.json() as { messages: Message[] };
    setMessages(data.messages ?? []);
    setLoadingMsgs(false);
    loadThreads();
  }

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    const key = selected.thread_id ?? selected.id;
    await fetch('/api/admin/email/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: key, text: replyText.trim() }),
    });
    setSending(false);
    setReplyText('');
    const res  = await fetch(`/api/admin/mensajes/${key}`);
    const data = await res.json() as { messages: Message[] };
    setMessages(data.messages ?? []);
    loadThreads();
  }

  async function handleAiSuggest() {
    if (!selected) return;
    setSuggesting(true);
    const lastMsg  = messages.filter(m => m.sender_username !== 'neuropost_team').at(-1);
    const context  = `Prospect por email: ${selected.sender_id ?? selected.sender_username ?? 'desconocido'}`;
    const res = await fetch('/api/admin/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, platform: 'email', lastMessage: lastMsg?.content }),
    });
    const data = await res.json() as { suggestion: string };
    if (data.suggestion) setReplyText(data.suggestion);
    setSuggesting(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Thread list */}
      <div style={{ width: 340, borderRight: `1px solid ${A.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 18px 12px', borderBottom: `1px solid ${A.border}` }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: A.text, margin: '0 0 12px' }}>Email ({total})</h1>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 7, color: A.text, fontSize: 12, padding: '7px 10px', outline: 'none' }}
          >
            {['', 'unread', 'read', 'replied', 'archived'].map(s => (
              <option key={s} value={s}>{s || 'Todos'}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 20, color: A.muted, fontSize: 13 }}>Cargando...</div>}
          {!loading && threads.length === 0 && <div style={{ padding: 20, color: A.muted, fontSize: 13 }}>Sin emails.</div>}
          {!loading && threads.map(t => (
            <div
              key={t.id}
              onClick={() => selectThread(t)}
              style={{
                padding: '14px 18px', borderBottom: `1px solid ${A.border}`, cursor: 'pointer',
                background: selected?.id === t.id ? '#22201e' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: t.status === 'unread' ? 700 : 500, color: A.text }}>
                  {t.prospects?.full_name ?? t.sender_username ?? t.sender_id ?? '—'}
                </span>
                <span style={{ fontSize: 10, color: A.muted, flexShrink: 0 }}>{timeStr(t.created_at)}</span>
              </div>
              <p style={{ fontSize: 11, color: A.muted, margin: '0 0 2px' }}>{t.sender_id}</p>
              <p style={{ fontSize: 12, color: A.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.content ?? '(sin contenido)'}
              </p>
              {t.status === 'unread' && (
                <div style={{ marginTop: 4, width: 7, height: 7, borderRadius: '50%', background: A.orange }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversation */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${A.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: A.text }}>
                {selected.prospects?.full_name ?? selected.sender_username ?? selected.sender_id ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: A.muted }}>{selected.sender_id}</div>
            </div>
            {selected.prospect_id && (
              <Link href={`/captacion/prospects/${selected.prospect_id}`} style={{ fontSize: 12, color: A.orange, textDecoration: 'none' }}>Ver perfil →</Link>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingMsgs && <div style={{ color: A.muted, fontSize: 13 }}>Cargando...</div>}
            {!loadingMsgs && messages.map(m => {
              const isUs = m.sender_username === 'neuropost_team' || m.sender_id === 'hola@neuropost.app';
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: isUs ? 'row-reverse' : 'row' }}>
                  <div style={{ maxWidth: '75%', background: isUs ? 'rgba(255,107,53,0.18)' : A.card, borderRadius: isUs ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '12px 16px' }}>
                    {!isUs && <p style={{ fontSize: 10, color: A.orange, fontWeight: 700, margin: '0 0 6px' }}>{m.sender_id ?? m.sender_username}</p>}
                    <p style={{ fontSize: 13, color: A.text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content ?? m.our_reply ?? '(vacío)'}</p>
                    <p style={{ fontSize: 10, color: '#555', margin: '6px 0 0', textAlign: isUs ? 'left' : 'right' }}>{timeStr(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply */}
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
                placeholder="Escribe tu respuesta..."
                rows={4}
                style={{ flex: 1, background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, color: A.text, fontSize: 13, padding: '10px 12px', resize: 'none', outline: 'none' }}
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
          Selecciona un hilo de email
        </div>
      )}
    </div>
  );
}
