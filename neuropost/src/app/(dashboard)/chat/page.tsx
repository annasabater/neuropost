'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, CheckCheck } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

type ChatMessage = {
  id: string;
  sender_type: 'client' | 'worker';
  message: string;
  attachments: Array<{ url: string; type: string; name: string }>;
  read_at: string | null;
  created_at: string;
};

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.messages.push(msg);
    else groups.push({ date: d, messages: [msg] });
  }
  return groups;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase  = createBrowserClient();

  useEffect(() => {
    fetch('/api/chat').then((r) => r.json()).then((d) => {
      setMessages(d.messages ?? []);
      setLoading(false);
    });
    // Mark as read
    fetch('/api/chat/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });

    // Realtime
    const channel = supabase
      .channel('chat-client')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_type === 'worker') toast('💬 Nuevo mensaje de tu equipo');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = { message: text.trim() };
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setText(''); }
    else { const d = await res.json(); toast.error(d.error ?? 'Error al enviar'); }
    setSending(false);
  }

  const groups = groupByDate(messages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
          NP
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Tu equipo NeuroPost</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Respondemos en menos de 2 horas en horario laboral</div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 60 }}>Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontWeight: 700, marginTop: 12, fontSize: 16 }}>Empieza la conversación</div>
            <div style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>Escríbele a tu equipo si necesitas algo</div>
          </div>
        ) : groups.map((group) => (
          <div key={group.date}>
            <div style={{ textAlign: 'center', margin: '16px 0', fontSize: 12, color: '#9ca3af' }}>
              <span style={{ background: '#f3f4f6', padding: '3px 12px', borderRadius: 12 }}>{group.date}</span>
            </div>
            {group.messages.map((msg) => {
              const isClient = msg.sender_type === 'client';
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    maxWidth: '68%',
                    background: isClient ? '#fff3ee' : '#f3f4f6',
                    border: `1px solid ${isClient ? '#ffd5c2' : '#e5e7eb'}`,
                    borderRadius: isClient ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    position: 'relative',
                  }}>
                    {msg.message && <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.5 }}>{msg.message}</div>}
                    {msg.attachments?.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontSize: 13, color: '#ff6b35' }}>
                        📎 {att.name ?? 'Adjunto'}
                      </a>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{formatTime(msg.created_at)}</span>
                      {isClient && <CheckCheck size={12} color={msg.read_at ? '#3b82f6' : '#9ca3af'} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 24, padding: '10px 18px' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Escribe un mensaje..."
            rows={1}
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 14, fontFamily: 'inherit' }}
          />
        </div>
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          style={{ width: 44, height: 44, borderRadius: '50%', background: text.trim() ? '#ff6b35' : '#e5e7eb', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}
        >
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}
