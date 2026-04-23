'use client';

import { useEffect } from 'react';
import type { PromoContentV2T } from '@/types';
import {
  inputStyle, selectStyle, labelStyle,
  Collapsible, ChipsInput, isoToLocalInput, localInputToIso,
} from './_v2/shared';

function emptyContent(): PromoContentV2T {
  return { schema_version: 2, title: '', description: '' };
}

export function PromoFormV2({
  value,
  onChange,
}: {
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = (value as Partial<PromoContentV2T> | undefined) ?? {};

  useEffect(() => {
    if (v.schema_version !== 2) onChange(emptyContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data: PromoContentV2T = v.schema_version === 2 ? (v as PromoContentV2T) : emptyContent();

  function emit(next: PromoContentV2T) {
    onChange({ ...next, schema_version: 2 });
  }

  function set<K extends keyof PromoContentV2T>(key: K, val: PromoContentV2T[K]) {
    emit({ ...data, [key]: val });
  }

  const discount = data.discount;
  const cta      = data.cta;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Título *</label>
        <input
          value={data.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Ej: 20% en toda la carta este fin de semana"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descripción *</label>
        <textarea
          value={data.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
          placeholder="Detalles de la promo..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={labelStyle}>Condiciones (opcional)</label>
        <textarea
          value={data.conditions ?? ''}
          onChange={e => set('conditions', e.target.value || undefined)}
          rows={2}
          placeholder="Ej: No acumulable con otras ofertas..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={labelStyle}>Público objetivo (opcional)</label>
        <ChipsInput
          value={data.target_audience ?? []}
          onChange={vs => set('target_audience', vs.length ? vs : undefined)}
          placeholder="Ej: familias, estudiantes..."
        />
      </div>

      <Collapsible title="Descuento">
        <div>
          <label style={labelStyle}>Tipo</label>
          <select
            value={discount?.type ?? ''}
            onChange={e => {
              const type = e.target.value as '' | 'percent' | 'fixed' | 'free';
              if (!type) { set('discount', undefined); return; }
              set('discount', { type, value: discount?.value });
            }}
            style={selectStyle}
          >
            <option value="">— Sin descuento —</option>
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Fijo (importe)</option>
            <option value="free">Gratis</option>
          </select>
        </div>
        {discount && discount.type !== 'free' && (
          <div>
            <label style={labelStyle}>Valor</label>
            <input
              value={discount.value ?? ''}
              onChange={e => set('discount', { ...discount, value: e.target.value || undefined })}
              placeholder={discount.type === 'percent' ? 'Ej: 20' : 'Ej: 5€'}
              style={inputStyle}
            />
          </div>
        )}
      </Collapsible>

      <Collapsible title="Enlace a tu web (opcional)">
        <p style={{ fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginBottom: 4, lineHeight: 1.5 }}>
          Si tienes página web donde los clientes pueden reservar o comprar, añádela aquí. La mencionaremos en tus publicaciones cuando tenga sentido.
        </p>
        <div>
          <label style={labelStyle}>Texto del enlace</label>
          <input
            value={cta?.label ?? ''}
            onChange={e => {
              const label = e.target.value;
              const url   = cta?.url ?? '';
              if (!label && !url) { set('cta', undefined); return; }
              set('cta', { label, url });
            }}
            placeholder="Reserva ahora · Ver menú · Pedir cita"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>URL de tu web</label>
          <input
            value={cta?.url ?? ''}
            onChange={e => {
              const url   = e.target.value;
              const label = cta?.label ?? '';
              if (!label && !url) { set('cta', undefined); return; }
              set('cta', { label, url });
            }}
            placeholder="https://miweb.com/reservas"
            style={inputStyle}
          />
        </div>
      </Collapsible>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Válido desde</label>
          <input
            type="datetime-local"
            value={isoToLocalInput(data.valid_from)}
            onChange={e => set('valid_from', localInputToIso(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Válido hasta</label>
          <input
            type="datetime-local"
            value={isoToLocalInput(data.valid_to)}
            onChange={e => set('valid_to', localInputToIso(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>

    </div>
  );
}
