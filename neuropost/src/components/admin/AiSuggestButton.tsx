'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  context:   string;       // conversation or post context to send to AI
  platform:  string;       // 'instagram_comment'|'dm'|'email'
  onSuggest: (text: string) => void;
}

export function AiSuggestButton({ context, platform, onSuggest }: Props) {
  const [loading, setLoading] = useState(false);

  async function suggest() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/ai-suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context, platform }),
      });
      const json = await res.json();
      if (json.suggestion) onSuggest(json.suggestion);
    } catch { /* non-blocking */ }
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={suggest}
      disabled={loading}
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        padding:    '7px 14px',
        borderRadius: 8,
        background: loading ? '#2a2927' : 'rgba(255,107,53,0.15)',
        color:      loading ? '#555' : '#ff6b35',
        border:     '1px solid rgba(255,107,53,0.3)',
        cursor:     loading ? 'not-allowed' : 'pointer',
        fontSize:   13,
        fontWeight: 600,
      }}
    >
      <Sparkles size={13} />
      {loading ? 'Generando...' : '✦ Sugerir con IA'}
    </button>
  );
}
