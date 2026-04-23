'use client';

import { useEffect } from 'react';
import type { FreeContentV2T } from '@/types';
import { inputStyle, selectStyle, labelStyle } from './_v2/shared';

const INTENT_OPTIONS: { value: FreeContentV2T['intent'] | ''; label: string }[] = [
  { value: '',           label: '— Sin intención —' },
  { value: 'historia',   label: 'Historia' },
  { value: 'valores',    label: 'Valores' },
  { value: 'tono_marca', label: 'Tono de marca' },
  { value: 'aviso',      label: 'Aviso' },
  { value: 'otro',       label: 'Otro' },
];

function emptyContent(): FreeContentV2T {
  return { schema_version: 2, content: '' };
}

export function FreeFormV2({
  value,
  onChange,
}: {
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = (value as Partial<FreeContentV2T> | undefined) ?? {};

  useEffect(() => {
    if (v.schema_version !== 2) onChange(emptyContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data: FreeContentV2T = v.schema_version === 2 ? (v as FreeContentV2T) : emptyContent();

  function emit(next: FreeContentV2T) {
    onChange({ ...next, schema_version: 2 });
  }

  function set<K extends keyof FreeContentV2T>(key: K, val: FreeContentV2T[K]) {
    emit({ ...data, [key]: val });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Título (opcional)</label>
        <input
          value={data.title ?? ''}
          onChange={e => set('title', e.target.value || undefined)}
          placeholder="Ej: Nuestra historia"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Contenido *</label>
        <textarea
          value={data.content}
          onChange={e => set('content', e.target.value)}
          rows={6}
          placeholder="Escribe cualquier información relevante de tu marca que quieras que nuestro equipo tenga en cuenta..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Intención (opcional)</label>
        <select
          value={data.intent ?? ''}
          onChange={e => {
            const next = e.target.value as FreeContentV2T['intent'] | '';
            set('intent', next ? (next as FreeContentV2T['intent']) : undefined);
          }}
          style={selectStyle}
        >
          {INTENT_OPTIONS.map(o => (
            <option key={o.value ?? ''} value={o.value ?? ''}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
