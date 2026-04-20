'use client';

import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { IdeaItem } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  onResults: (ideas: IdeaItem[]) => void;
}

export function AIProposalBanner({ onResults }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    const prompt = inputRef.current?.value.trim();
    if (!prompt) { toast.error('Describe tu negocio o qué buscas'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/agents/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, count: 4 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error generando ideas');
      onResults(json.data.ideas ?? []);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: '#EFF6FF',
      border: '1px solid #BFDBFE',
      marginBottom: 20,
    }}>
      <Sparkles size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        placeholder="¿Tienes algo en mente? Descríbelo y te propongo ideas adaptadas a tu negocio"
        onKeyDown={e => e.key === 'Enter' && handleGenerate()}
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent',
          fontFamily: f, fontSize: 13, color: '#1e3a5f',
        }}
      />
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '7px 16px',
          background: '#2563EB', color: '#fff', border: 'none',
          fontFamily: fc, fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          cursor: loading ? 'wait' : 'pointer',
          flexShrink: 0,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Generando…' : 'Generar'}
      </button>
    </div>
  );
}
