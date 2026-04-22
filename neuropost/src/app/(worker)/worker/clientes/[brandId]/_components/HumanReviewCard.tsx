'use client';

import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Toggle } from '@/components/ui/Toggle';
import {
  HARD_DEFAULT,
  HRC_UI_KEYS,
  computeDiffOverride,
  resolveHumanReviewConfig,
  type HrcUiKey,
} from '@/lib/human-review';
import type { HumanReviewConfig } from '@/types';

interface HumanReviewCardProps {
  brandId:       string;
  initialConfig: Partial<HumanReviewConfig> | null;
  defaults:      HumanReviewConfig | null;
}

const C = {
  card:   '#ffffff',
  border: '#e5e7eb',
  muted:  '#6b7280',
  accent: '#0F766E',
  bg1:    '#f3f4f6',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const LABEL: Record<HrcUiKey, string> = {
  messages: 'mensajes',
  images:   'imágenes',
  videos:   'vídeos',
};

const TOGGLES: Array<{ key: HrcUiKey; title: string; description: string }> = [
  { key: 'messages', title: 'Mensajes semanales',  description: 'El plan de ideas pasa por el worker antes de enviarlo al cliente' },
  { key: 'images',   title: 'Imágenes generadas',  description: 'Cada imagen pasa por el worker antes del cliente' },
  { key: 'videos',   title: 'Vídeos generados',    description: 'Cada vídeo pasa por el worker antes del cliente' },
];

export function HumanReviewCard({ brandId, initialConfig, defaults }: HumanReviewCardProps) {
  const effectiveDefaults: HumanReviewConfig = defaults ?? HARD_DEFAULT;

  const [override, setOverride] = useState<Partial<HumanReviewConfig> | null>(() => initialConfig);
  const [saving, setSaving]     = useState<Partial<Record<HrcUiKey, boolean>>>({});
  const [resetting, setResetting] = useState(false);

  const effective = useMemo(
    () => resolveHumanReviewConfig(override, effectiveDefaults),
    [override, effectiveDefaults],
  );

  const hasOverride = override !== null && Object.keys(override).length > 0;

  async function setFlag(key: HrcUiKey, next: boolean) {
    const prevEffective = effective[key];
    if (prevEffective === next) return;

    const prevOverride = override;
    const desired: HumanReviewConfig = { ...effective, [key]: next };
    const newOverride  = computeDiffOverride(desired, effectiveDefaults);

    setOverride(newOverride);
    setSaving((s) => ({ ...s, [key]: true }));

    try {
      const res = await fetch(`/api/worker/brands/${brandId}/human-review-config`, {
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
      const inherits = next === effectiveDefaults[key];
      toast.success(
        `Revisión de ${LABEL[key]} ${next ? 'activada' : 'desactivada'}${inherits ? ' (hereda del global)' : ''}`,
      );
    } catch (err) {
      setOverride(prevOverride);
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function resetToInheritance() {
    if (!hasOverride) return;
    const prev = override;
    setOverride(null);
    setResetting(true);
    try {
      const res = await fetch(`/api/worker/brands/${brandId}/human-review-config`, {
        method: 'DELETE',
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al resetear');
      toast.success('Override eliminado — la marca hereda los defaults globales');
    } catch (err) {
      setOverride(prev);
      toast.error(err instanceof Error ? err.message : 'No se pudo resetear');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, background: C.card, padding: 20 }}>
      <h4 style={{
        fontSize:       11,
        fontWeight:     700,
        color:          C.muted,
        textTransform:  'uppercase',
        letterSpacing:  '0.06em',
        marginBottom:   12,
        fontFamily:     fc,
      }}>
        Revisión humana
      </h4>

      {TOGGLES.map(({ key, title, description }) => {
        const isOverride = override !== null && Object.prototype.hasOwnProperty.call(override, key);
        return (
          <Toggle
            key={key}
            checked={effective[key]}
            onChange={(next) => { void setFlag(key, next); }}
            label={title}
            description={description}
            disabled={saving[key] === true || resetting}
            rightSlot={
              <span style={{
                fontSize:       9,
                fontWeight:     700,
                padding:        '2px 6px',
                letterSpacing:  '0.06em',
                textTransform:  'uppercase',
                fontFamily:     fc,
                background:     isOverride ? C.accent : C.bg1,
                color:          isOverride ? '#fff'   : C.muted,
              }}>
                {isOverride ? 'Override' : 'Heredado'}
              </span>
            }
          />
        );
      })}

      {hasOverride && (
        <button
          type="button"
          onClick={() => { void resetToInheritance(); }}
          disabled={resetting}
          style={{
            marginTop:  12,
            padding:    '6px 12px',
            background: 'transparent',
            color:      C.accent,
            border:     `1px solid ${C.border}`,
            borderRadius: 0,
            fontSize:   11,
            fontWeight: 700,
            fontFamily: fc,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor:     resetting ? 'not-allowed' : 'pointer',
          }}
        >
          ↺ Resetear a herencia
        </button>
      )}

      <div style={{
        fontSize:   11,
        color:      C.muted,
        marginTop:  12,
        fontStyle:  'italic',
        fontFamily: f,
      }}>
        Los cambios se guardan automáticamente
      </div>
    </div>
  );
}

// Keep the previous UI keys export used by other callers if any.
export { HRC_UI_KEYS };
