'use client';

import { RotateCcw } from 'lucide-react';
import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { BriefDraft } from './cockpit-types';

export type { BriefDraft };

type Props = {
  draft: BriefDraft;
  onChange: (draft: BriefDraft) => void;
  onReset: () => void;
};

const MODELS: { value: BriefDraft['model']; label: string }[] = [
  { value: 'flux-kontext-pro', label: 'Flux Kontext Pro' },
  { value: 'flux-pro',         label: 'Flux Pro'         },
  { value: 'higgsfield',       label: 'Higgsfield'       },
  { value: 'nanobanana',       label: 'NanoBanana'       },
];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#111',
  fontSize: 13,
  fontFamily: f,
  boxSizing: 'border-box',
  outline: 'none',
  borderRadius: 0,
};

function Label({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: fc,
      letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 4,
    }}>
      {text}
    </div>
  );
}

export function AgentBriefEditor({ draft, onChange, onReset }: Props) {
  const set = <K extends keyof BriefDraft>(key: K, val: BriefDraft[K]) =>
    onChange({ ...draft, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: fc,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
        }}>
          BRIEF DEL AGENTE
        </span>
        <button
          onClick={onReset}
          title="Restablecer al brief original"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: '1px solid #e5e7eb',
            padding: '4px 10px', cursor: 'pointer', color: '#6b7280',
            fontSize: 11, fontFamily: f, fontWeight: 600,
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* Prompt */}
      <div>
        <Label text="PROMPT *" />
        <textarea
          value={draft.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          rows={5}
          style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.5 }}
          placeholder="Describe visualmente el post..."
        />
      </div>

      {/* Negative prompt */}
      <div>
        <Label text="NEGATIVE PROMPT" />
        <textarea
          value={draft.negative_prompt}
          onChange={(e) => set('negative_prompt', e.target.value)}
          rows={2}
          style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.5 }}
          placeholder="Lo que NO quieres ver..."
        />
      </div>

      {/* Model */}
      <div>
        <Label text="MODELO" />
        <select
          value={draft.model}
          onChange={(e) => set('model', e.target.value as BriefDraft['model'])}
          style={INPUT_STYLE}
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Edit strength */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Label text="EDIT STRENGTH" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F766E', fontFamily: f }}>
            {draft.edit_strength.toFixed(2)}
          </span>
        </div>
        <input
          type="range" min={0} max={1} step={0.05}
          value={draft.edit_strength}
          onChange={(e) => set('edit_strength', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#0F766E' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', fontFamily: f, marginTop: 2 }}>
          <span>0 — solo prompt</span><span>1 — solo imagen</span>
        </div>
      </div>

      {/* Guidance */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Label text="GUIDANCE" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F766E', fontFamily: f }}>
            {draft.guidance.toFixed(1)}
          </span>
        </div>
        <input
          type="range" min={1} max={10} step={0.5}
          value={draft.guidance}
          onChange={(e) => set('guidance', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#0F766E' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', fontFamily: f, marginTop: 2 }}>
          <span>1 — libre</span><span>10 — estricto</span>
        </div>
      </div>

      {/* Num outputs */}
      <div>
        <Label text="VARIANTES" />
        <input
          type="number" min={1} max={4}
          value={draft.num_outputs}
          onChange={(e) => set('num_outputs', Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
          style={{ ...INPUT_STYLE, width: 80 }}
        />
      </div>

      {/* Primary image URL */}
      <div>
        <Label text="IMAGEN DE REFERENCIA (URL)" />
        <input
          type="text"
          value={draft.primary_image_url}
          onChange={(e) => set('primary_image_url', e.target.value)}
          style={INPUT_STYLE}
          placeholder="https://..."
        />
        {draft.primary_image_url && (
          <div style={{ marginTop: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.primary_image_url}
              alt="referencia"
              style={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
