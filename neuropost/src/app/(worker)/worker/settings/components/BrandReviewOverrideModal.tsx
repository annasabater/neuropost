'use client';

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Toggle } from '@/components/ui/Toggle';
import {
  HRC_UI_KEYS,
  computeDiffOverride,
  resolveHumanReviewConfig,
  type HrcUiKey,
} from '@/lib/human-review';
import type { HumanReviewConfig } from '@/types';

interface BrandLite {
  id:                  string;
  name:                string;
  human_review_config: Partial<HumanReviewConfig> | null;
}

interface Props {
  brand:    BrandLite;
  defaults: HumanReviewConfig;
  onClose:  () => void;
  onSaved:  () => void;
}

const C = {
  card:   '#ffffff',
  border: '#e5e7eb',
  bg1:    '#f3f4f6',
  text:   '#111111',
  muted:  '#6b7280',
  accent: '#0F766E',
  red:    '#991b1b',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const LABEL: Record<HrcUiKey, string> = {
  messages_create: 'mensajes (crear)',
  images_create:   'imágenes (crear)',
  videos_create:   'vídeos (crear)',
  messages_regen:  'mensajes (regenerar)',
  images_regen:    'imágenes (regenerar)',
  videos_regen:    'vídeos (regenerar)',
};

const TOGGLES_CREATE: Array<{ key: HrcUiKey; title: string; description: string }> = [
  { key: 'messages_create', title: 'Mensajes semanales',  description: 'El plan de ideas pasa por el worker antes de enviarlo al cliente' },
  { key: 'images_create',   title: 'Imágenes generadas',  description: 'Cada imagen generada pasa por el worker antes del cliente' },
  { key: 'videos_create',   title: 'Vídeos generados',    description: 'Cada vídeo generado pasa por el worker antes del cliente' },
];

const TOGGLES_REGEN: Array<{ key: HrcUiKey; title: string; description: string }> = [
  { key: 'messages_regen', title: 'Mensajes regenerados', description: 'La idea regenerada pasa por el worker antes del cliente' },
  { key: 'images_regen',   title: 'Imágenes regeneradas', description: 'Cada imagen regenerada pasa por el worker antes del cliente' },
  { key: 'videos_regen',   title: 'Vídeos regenerados',   description: 'Cada vídeo regenerado pasa por el worker antes del cliente' },
];

export function BrandReviewOverrideModal({ brand, defaults, onClose, onSaved }: Props) {
  const [override, setOverride] = useState<Partial<HumanReviewConfig> | null>(() => brand.human_review_config);
  const [saving, setSaving]     = useState<Partial<Record<HrcUiKey, boolean>>>({});
  const [resetting, setResetting] = useState(false);

  const effective = useMemo(
    () => resolveHumanReviewConfig(override, defaults),
    [override, defaults],
  );

  async function setFlag(key: HrcUiKey, next: boolean) {
    const prevEffective = effective[key];
    if (prevEffective === next) return;

    const prevOverride = override;
    const desired: HumanReviewConfig = { ...effective, [key]: next };
    const newOverride = computeDiffOverride(desired, defaults);

    setOverride(newOverride);
    setSaving((s) => ({ ...s, [key]: true }));

    try {
      const res = await fetch(`/api/worker/brands/${brand.id}/human-review-config`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: next }),
      });
      const data = await res.json() as {
        human_review_config?: Partial<HumanReviewConfig> | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      if (data.human_review_config !== undefined) setOverride(data.human_review_config);
      const inherits = next === defaults[key];
      toast.success(
        `Revisión de ${LABEL[key]} ${next ? 'activada' : 'desactivada'}${inherits ? ' (hereda del global)' : ''}`,
      );
      onSaved();
    } catch (err) {
      setOverride(prevOverride);
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function resetToInheritance() {
    const prev = override;
    setOverride(null);
    setResetting(true);
    try {
      const res = await fetch(`/api/worker/brands/${brand.id}/human-review-config`, {
        method: 'DELETE',
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al resetear');
      toast.success('Override eliminado — hereda los defaults globales');
      onSaved();
    } catch (err) {
      setOverride(prev);
      toast.error(err instanceof Error ? err.message : 'No se pudo resetear');
    } finally {
      setResetting(false);
    }
  }

  const hasOverride = override !== null && Object.keys(override).length > 0;

  function renderToggles(list: typeof TOGGLES_CREATE) {
    return list.map(({ key, title, description }) => {
      const isOverride = override !== null && Object.prototype.hasOwnProperty.call(override, key);
      const globalValue = defaults[key] ? 'ON' : 'OFF';
      return (
        <Toggle
          key={key}
          checked={effective[key]}
          onChange={(next) => { void setFlag(key, next); }}
          label={title}
          description={`${description} · Valor global: ${globalValue}`}
          disabled={saving[key] === true || resetting}
          rightSlot={
            <span style={{
              fontSize:      9,
              fontWeight:    700,
              padding:       '2px 6px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily:    fc,
              background:    isOverride ? C.accent : C.bg1,
              color:         isOverride ? '#fff'   : C.muted,
            }}>
              {isOverride ? 'Override' : 'Heredado'}
            </span>
          }
        />
      );
    });
  }

  const sectionHeader: React.CSSProperties = {
    fontSize:       10,
    fontWeight:     800,
    color:          C.accent,
    textTransform:  'uppercase',
    letterSpacing:  '0.08em',
    fontFamily:     fc,
    marginBottom:   6,
    paddingBottom:  4,
    borderBottom:   `1px solid ${C.border}`,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 0,
        padding: 28, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h2 style={{
              fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: fc,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Revisión humana
            </h2>
            <p style={{ fontSize: 13, color: C.text, margin: '4px 0 0', fontFamily: f, fontWeight: 600 }}>
              {brand.name}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0,
          }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 16px', fontFamily: f }}>
          Override sobre los defaults globales. Cada cambio se guarda al instante.
        </p>

        <div style={sectionHeader}>Al generar ideas (lunes)</div>
        {renderToggles(TOGGLES_CREATE)}

        <div style={{ ...sectionHeader, marginTop: 16 }}>Al regenerar variaciones</div>
        {renderToggles(TOGGLES_REGEN)}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`,
        }}>
          <button
            type="button"
            onClick={() => { void resetToInheritance(); }}
            disabled={!hasOverride || resetting}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: hasOverride ? C.accent : C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: fc,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: hasOverride && !resetting ? 'pointer' : 'not-allowed',
              opacity: hasOverride ? 1 : 0.5,
            }}
          >
            ↺ Resetear a herencia
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: C.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: fc,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
