'use client';

import { useEffect } from 'react';
import type { QuoteContentV2T } from '@/types';
import { inputStyle, labelStyle } from './_v2/shared';

const SOURCE_OPTIONS: { value: QuoteContentV2T['source'] | ''; label: string }[] = [
  { value: '',            label: '— Sin origen —' },
  { value: 'cliente',     label: 'Cliente' },
  { value: 'equipo',      label: 'Equipo' },
  { value: 'propietario', label: 'Propietario' },
  { value: 'prensa',      label: 'Prensa' },
];

function emptyContent(): QuoteContentV2T {
  return { schema_version: 2, text: '', author: '' };
}

export function QuoteFormV2({
  value,
  onChange,
}: {
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = (value as Partial<QuoteContentV2T> | undefined) ?? {};

  useEffect(() => {
    if (v.schema_version !== 2) onChange(emptyContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data: QuoteContentV2T = v.schema_version === 2 ? (v as QuoteContentV2T) : emptyContent();

  function emit(next: QuoteContentV2T) {
    onChange({ ...next, schema_version: 2 });
  }

  function set<K extends keyof QuoteContentV2T>(key: K, val: QuoteContentV2T[K]) {
    emit({ ...data, [key]: val });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Frase *</label>
        <textarea
          value={data.text}
          onChange={e => set('text', e.target.value)}
          rows={3}
          placeholder="Ej: La artesanía no se improvisa, se cultiva."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Autor *</label>
        <input
          value={data.author}
          onChange={e => set('author', e.target.value)}
          placeholder="Ej: María García, fundadora"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Origen (opcional)</label>
        <select
          value={data.source ?? ''}
          onChange={e => {
            const next = e.target.value as QuoteContentV2T['source'] | '';
            set('source', next ? (next as QuoteContentV2T['source']) : undefined);
          }}
          style={inputStyle}
        >
          {SOURCE_OPTIONS.map(o => (
            <option key={o.value ?? ''} value={o.value ?? ''}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Fecha (opcional)</label>
        <input
          type="date"
          value={data.date ?? ''}
          onChange={e => set('date', e.target.value || undefined)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Servicio relacionado (opcional)</label>
        <input
          value={data.related_service ?? ''}
          onChange={e => set('related_service', e.target.value || undefined)}
          placeholder="Ej: Higiene bucal, Menú degustación..."
          style={inputStyle}
        />
      </div>
    </div>
  );
}
