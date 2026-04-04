'use client';

import { useState } from 'react';
import { AiSuggestButton } from './AiSuggestButton';
import { Send, ThumbsUp } from 'lucide-react';

interface ThreadMessage {
  id:        string;
  from:      'us' | 'them';
  content:   string;
  timestamp: string;
  username?: string;
}

interface Props {
  messages:   ThreadMessage[];
  platform:   'comment' | 'dm' | 'email';
  onReply:    (text: string) => Promise<void>;
  onLike?:    (messageId: string) => Promise<void>;
  liked?:     Set<string>;
  context:    string;   // for AI suggestion
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function ConversationThread({ messages, platform, onReply, onLike, liked = new Set(), context }: Props) {
  const [reply,   setReply]   = useState('');
  const [sending, setSending] = useState(false);
  const [liking,  setLiking]  = useState<string | null>(null);

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    try { await onReply(reply.trim()); setReply(''); }
    finally { setSending(false); }
  }

  async function handleLike(id: string) {
    if (!onLike || liking) return;
    setLiking(id);
    try { await onLike(id); }
    finally { setLiking(null); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg) => {
          const isUs   = msg.from === 'us';
          const isLiked = liked.has(msg.id);

          return (
            <div
              key={msg.id}
              style={{
                display:        'flex',
                flexDirection:  isUs ? 'row-reverse' : 'row',
                gap:            8,
                alignItems:     'flex-end',
              }}
            >
              <div style={{
                maxWidth:     '72%',
                background:   isUs ? 'rgba(255,107,53,0.18)' : '#2a2927',
                borderRadius: isUs ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding:      '10px 14px',
                position:     'relative',
              }}>
                {!isUs && msg.username && (
                  <p style={{ fontSize: 10, color: '#ff6b35', fontWeight: 700, margin: '0 0 4px' }}>
                    @{msg.username}
                  </p>
                )}
                <p style={{ fontSize: 13, color: '#e8e3db', margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                <p style={{ fontSize: 10, color: '#555', margin: '4px 0 0', textAlign: isUs ? 'left' : 'right' }}>
                  {timeStr(msg.timestamp)}
                </p>

                {/* Like button for their messages */}
                {!isUs && onLike && platform === 'comment' && (
                  <button
                    onClick={() => handleLike(msg.id)}
                    disabled={isLiked || liking === msg.id}
                    style={{
                      position:   'absolute',
                      bottom:     -10, right: 8,
                      background: isLiked ? '#2a4a2a' : '#1a1917',
                      border:     `1px solid ${isLiked ? '#4ade80' : '#2a2927'}`,
                      borderRadius: 20,
                      padding:    '2px 7px',
                      cursor:     isLiked ? 'default' : 'pointer',
                      fontSize:   11, color: isLiked ? '#4ade80' : '#888',
                      display:    'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <ThumbsUp size={10} />
                    {isLiked ? 'Me gusta' : '👍'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box */}
      <div style={{ borderTop: '1px solid #2a2927', padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <AiSuggestButton
            context={context}
            platform={platform}
            onSuggest={(text) => setReply(text)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escribe una respuesta..."
            rows={3}
            style={{
              flex:        1,
              background:  '#1a1917',
              border:      '1px solid #2a2927',
              borderRadius: 8,
              color:       '#e8e3db',
              fontSize:    13,
              padding:     '10px 12px',
              resize:      'none',
              outline:     'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !reply.trim()}
            style={{
              padding:    '0 16px',
              borderRadius: 8,
              background:   sending || !reply.trim() ? '#2a2927' : '#ff6b35',
              color:        sending || !reply.trim() ? '#555' : '#fff',
              border:       'none',
              cursor:       sending || !reply.trim() ? 'not-allowed' : 'pointer',
              display:      'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            }}
          >
            <Send size={13} />
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#444', marginTop: 6 }}>⌘ + Enter para enviar</p>
      </div>
    </div>
  );
}
