'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, CheckCheck, Paperclip } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";

type ChatMessage = {
  id: string; sender_type: 'client' | 'worker'; message: string;
  attachments: Array<{ url: string; type: string; name: string }>;
  read_at: string | null; created_at: string;
};

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    fetch('/api/chat').then((r) => r.json()).then((d) => { setMessages(d.messages ?? []); setLoading(false); });
    fetch('/api/chat/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel('chat-client')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_type === 'worker') toast('Nuevo mensaje del equipo de NeuroPost');
        }).subscribe();
    } catch { /* realtime not available */ }
    return () => { if (channel) supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    });
    if (res.ok) { setText(''); if (textareaRef.current) textareaRef.current.style.height = 'auto'; }
    else { const d = await res.json(); toast.error(d.error ?? 'Error al enviar'); }
    setSending(false);
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  const groups = groupByDate(messages);

  return (
    <div style={{
      margin: '-28px', display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 48px)', background: '#f9fafb', overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid #e5e7eb',
        padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, background: '#111827',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: f, flexShrink: 0,
        }}>
          NP
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: f, fontWeight: 700, fontSize: 14, color: '#111827' }}>Equipo NeuroPost</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F766E' }} />
            <span style={{ fontFamily: f, fontSize: 11, color: '#0F766E', fontWeight: 500 }}>En línea</span>
          </div>
          <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Respondemos en menos de 2h en horario laboral
          </p>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
            {[200, 160, 240].map((w, i) => (
              <div key={i} style={{ width: w, height: 32, background: '#f3f4f6', borderRadius: 4, alignSelf: i % 2 ? 'flex-start' : 'flex-end' }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 100 }}>
            <p style={{ fontFamily: f, fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 6 }}>
              ¿En qué podemos ayudarte?
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
              Nuestro equipo está listo para responder tus dudas
            </p>
            <button onClick={() => textareaRef.current?.focus()} style={{
              background: '#111827', color: '#ffffff', border: 'none',
              padding: '10px 24px', fontFamily: f, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Enviar primer mensaje
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div style={{ textAlign: 'center', margin: '20px 0 16px' }}>
                <span style={{
                  fontFamily: f, fontSize: 10, fontWeight: 600, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  background: '#f3f4f6', padding: '4px 14px',
                }}>
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isClient = msg.sender_type === 'client';
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                    {!isClient && (
                      <div style={{
                        width: 28, height: 28, background: '#111827', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, fontFamily: f, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end',
                      }}>NP</div>
                    )}
                    <div style={{
                      maxWidth: '60%',
                      background: isClient ? '#eef2ff' : '#ffffff',
                      border: `1px solid ${isClient ? '#c7d2fe' : '#e5e7eb'}`,
                      borderRadius: isClient ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '12px 16px',
                      transition: 'background 0.15s',
                    }}>
                      {msg.message && (
                        <p style={{ fontFamily: f, fontSize: 14, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                          {msg.message}
                        </p>
                      )}
                      {msg.attachments?.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                          fontFamily: f, fontSize: 12, color: '#0F766E', textDecoration: 'none', fontWeight: 500,
                        }}>
                          <Paperclip size={12} /> {att.name ?? 'Adjunto'}
                        </a>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 6 }}>
                        <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af' }}>{formatTime(msg.created_at)}</span>
                        {isClient && <CheckCheck size={12} color={msg.read_at ? '#0F766E' : '#d1d5db'} />}
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

      {/* ── Input ── */}
      <div style={{
        background: '#ffffff', borderTop: '1px solid #e5e7eb',
        padding: '14px 28px', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <div style={{
          flex: 1, background: '#f3f4f6', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: '10px 16px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={textareaRef} value={text} onChange={handleInput}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Escribe un mensaje..."
            rows={1}
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              resize: 'none', fontFamily: f, fontSize: 14, color: '#111827', lineHeight: 1.5,
            }}
          />
        </div>
        <button
          onClick={sendMessage} disabled={!text.trim() || sending}
          title="Enviar mensaje" aria-label="Enviar mensaje"
          style={{
            width: 40, height: 40, background: text.trim() ? '#111827' : '#e5e7eb',
            border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          <Send size={16} color="#ffffff" />
        </button>
      </div>
    </div>
  );
}
