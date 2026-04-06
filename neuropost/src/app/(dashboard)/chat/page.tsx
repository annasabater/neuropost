'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, CheckCheck, Paperclip } from 'lucide-react';
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
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase   = createBrowserClient();

  useEffect(() => {
    fetch('/api/chat').then((r) => r.json()).then((d) => {
      setMessages(d.messages ?? []);
      setLoading(false);
    });
    fetch('/api/chat/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('chat-client')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_type === 'worker') toast('💬 Nuevo mensaje de tu equipo');
        })
        .subscribe();
    } catch {
      // Realtime not available (e.g. HTTP in dev) — polling fallback not needed
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    });
    if (res.ok) {
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } else {
      const d = await res.json();
      toast.error(d.error ?? 'Error al enviar');
    }
    setSending(false);
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  const groups = groupByDate(messages);

  return (
    // Breakout of dash-main padding with negative margin
    <div style={{
      margin: '-28px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      background: 'var(--surface, #f9fafb)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexShrink: 0,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0,
        }}>
          NP
        </div>
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
            Tu equipo NeuroPost
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Respondemos en menos de 2 horas en horario laboral
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 60 }}>Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, marginTop: 12, fontSize: 16, color: 'var(--ink)' }}>
              Empieza la conversación
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
              Escríbele a tu equipo si necesitas ayuda
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date}>
              <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 11, color: 'var(--muted)' }}>
                <span style={{ background: 'var(--border)', padding: '3px 12px', borderRadius: 12 }}>{group.date}</span>
              </div>
              {group.messages.map((msg) => {
                const isClient = msg.sender_type === 'client';
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                    {!isClient && (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--accent)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
                      }}>NP</div>
                    )}
                    <div style={{
                      maxWidth: '65%',
                      background: isClient ? 'var(--accent-light)' : 'white',
                      border: `1px solid ${isClient ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: isClient ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '9px 14px',
                    }}>
                      {msg.message && (
                        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {msg.message}
                        </div>
                      )}
                      {msg.attachments?.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
                          <Paperclip size={12} /> {att.name ?? 'Adjunto'}
                        </a>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatTime(msg.created_at)}</span>
                        {isClient && <CheckCheck size={12} color={msg.read_at ? '#3b82f6' : 'var(--muted)'} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        background: 'white',
        borderTop: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <div style={{
          flex: 1,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '8px 16px',
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            style={{
              width: '100%', background: 'none', border: 'none',
              outline: 'none', resize: 'none', fontSize: 14,
              fontFamily: "'Cabinet Grotesk', sans-serif",
              color: 'var(--ink)', lineHeight: 1.5,
            }}
          />
        </div>
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: text.trim() ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          <Send size={17} color="white" />
        </button>
      </div>
    </div>
  );
}
