'use client';

import { useEffect } from 'react';
import type { DataContentV2T } from '@/types';
import {
  inputStyle, labelStyle, rowStyle, addBtnStyle, removeBtnStyle,
  Collapsible, ChipsInput, isoToLocalInput, localInputToIso,
} from './_v2/shared';

const TYPE_OPTIONS: { value: DataContentV2T['type']; label: string }[] = [
  { value: 'servicio',    label: 'Servicio' },
  { value: 'tratamiento', label: 'Tratamiento' },
  { value: 'carta',       label: 'Carta / Menú' },
  { value: 'clase',       label: 'Clase' },
  { value: 'producto',    label: 'Producto' },
  { value: 'experiencia', label: 'Experiencia' },
  { value: 'otro',        label: 'Otro' },
];

function emptyContent(): DataContentV2T {
  return {
    schema_version: 2,
    type: 'servicio',
    name: '',
    description: '',
  };
}

export function CatalogForm({
  value,
  onChange,
}: {
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = (value as Partial<DataContentV2T> | undefined) ?? {};

  useEffect(() => {
    if (v.schema_version !== 2) onChange(emptyContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data: DataContentV2T = v.schema_version === 2 ? (v as DataContentV2T) : emptyContent();

  function emit(next: DataContentV2T) {
    onChange({ ...next, schema_version: 2 });
  }

  function set<K extends keyof DataContentV2T>(key: K, val: DataContentV2T[K]) {
    emit({ ...data, [key]: val });
  }

  const variants = data.variants ?? [];
  function setVariants(next: typeof variants) {
    set('variants', next.length ? next : undefined);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Tipo *</label>
        <select
          value={data.type}
          onChange={e => set('type', e.target.value as DataContentV2T['type'])}
          style={inputStyle}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Nombre *</label>
        <input
          value={data.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ej: Higiene bucal, Menú fin de semana, Masaje relajante..."
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descripción *</label>
        <textarea
          value={data.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
          placeholder="Qué incluye, para quién, cualquier detalle relevante..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <Collapsible title="Detalles (precio, duración, etiquetas)">
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Precio</label>
            <input
              value={data.price ?? ''}
              onChange={e => set('price', e.target.value || undefined)}
              placeholder="Ej: Desde 45 €"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Duración</label>
            <input
              value={data.duration ?? ''}
              onChange={e => set('duration', e.target.value || undefined)}
              placeholder="Ej: 30 min, 1 hora..."
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Público objetivo</label>
          <ChipsInput
            value={data.target_audience ?? []}
            onChange={vs => set('target_audience', vs.length ? vs : undefined)}
            placeholder="Ej: familias, adultos mayores..."
          />
        </div>
        <div>
          <label style={labelStyle}>Etiquetas</label>
          <ChipsInput
            value={data.tags ?? []}
            onChange={vs => set('tags', vs.length ? vs : undefined)}
            placeholder="Ej: popular, nuevo, vegano..."
          />
        </div>
      </Collapsible>

      <div>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Variantes (opcional)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variants.map((variant, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--bg)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nombre *</label>
                  <input
                    value={variant.label}
                    onChange={e => setVariants(variants.map((vv, k) => k === i ? { ...vv, label: e.target.value } : vv))}
                    placeholder='Ej: "Con fluoración", "Entre semana"'
                    style={inputStyle}
                  />
                </div>
                <button type="button" onClick={() => setVariants(variants.filter((_, k) => k !== i))} style={{ ...removeBtnStyle, alignSelf: 'flex-end' }}>✕</button>
              </div>
              <div>
                <label style={labelStyle}>Descripción</label>
                <input
                  value={variant.description ?? ''}
                  onChange={e => setVariants(variants.map((vv, k) => k === i ? { ...vv, description: e.target.value || undefined } : vv))}
                  placeholder="Detalles de la variante..."
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Precio</label>
                  <input
                    value={variant.price ?? ''}
                    onChange={e => setVariants(variants.map((vv, k) => k === i ? { ...vv, price: e.target.value || undefined } : vv))}
                    placeholder="Ej: +10€"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Válido desde</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(variant.valid_from)}
                    onChange={e => setVariants(variants.map((vv, k) => k === i ? { ...vv, valid_from: localInputToIso(e.target.value) } : vv))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Válido hasta</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(variant.valid_to)}
                    onChange={e => setVariants(variants.map((vv, k) => k === i ? { ...vv, valid_to: localInputToIso(e.target.value) } : vv))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setVariants([...variants, { label: '' }])} style={addBtnStyle}>+ Añadir variante</button>
        </div>
      </div>
    </div>
  );
}
