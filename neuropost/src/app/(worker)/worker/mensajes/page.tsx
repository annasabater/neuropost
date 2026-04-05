'use client';

import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

type Msg = { id: string; message: string; created_at: string; from_worker_id: string; workers?: { full_name: string } };

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function MensajesPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function fetchMessages() {
    fetch('/api/worker/mensajes').then((r) => r.json()).then((d) => {
      setMessages((d.messages ?? []).reverse());
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }

  useEffect(() => { fetchMessages(); }, []);

  async function send() {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch('/api/worker/mensajes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (res.ok) { setText(''); fetchMessages(); }
    else toast.error('Error al enviar');
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: W.text, marginBottom: 4 }}>Canal del equipo</h1>
      <p style={{ color: W.muted, fontSize: 13, marginBottom: 20 }}>Mensajes internos entre trabajadores de NeuroPost</p>

      <div style={{ flex: 1, overflowY: 'auto', background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <p style={{ color: W.muted, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Sin mensajes todavía. ¡Sé el primero! 👋</p>
        ) : messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: W.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(msg.workers?.full_name ?? 'W').charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: W.text }}>{msg.workers?.full_name ?? 'Worker'}</span>
                <span style={{ fontSize: 10, color: W.muted }}>{timeAgo(msg.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, color: W.text, background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'inline-block', maxWidth: 480 }}>
                {msg.message}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Escribe un mensaje..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: W.card, border: `1px solid ${W.border}`, color: W.text, fontSize: 13, outline: 'none' }}
        />
        <button onClick={send} disabled={loading || !text.trim()} style={{ padding: '10px 20px', borderRadius: 8, background: W.blue, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading || !text.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
    </div>
  );
}
