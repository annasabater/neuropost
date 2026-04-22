'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Toggle } from '@/components/ui/Toggle';
import type { HumanReviewConfig } from '@/types';

interface HumanReviewCardProps {
  brandId:       string;
  initialConfig: HumanReviewConfig | null;
}

const C = {
  card:   '#ffffff',
  border: '#e5e7eb',
  muted:  '#6b7280',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type UiKey = 'messages' | 'images' | 'videos';

const DEFAULT: HumanReviewConfig = {
  messages: true,
  images:   true,
  videos:   true,
  requests: true,
};

const LABEL: Record<UiKey, string> = {
  messages: 'mensajes',
  images:   'imágenes',
  videos:   'vídeos',
};

const TOGGLES: Array<{ key: UiKey; title: string; description: string }> = [
  {
    key:         'messages',
    title:       'Mensajes semanales',
    description: 'El plan de ideas pasa por el worker antes de enviarlo al cliente',
  },
  {
    key:         'images',
    title:       'Imágenes generadas',
    description: 'Cada imagen pasa por el worker antes del cliente',
  },
  {
    key:         'videos',
    title:       'Vídeos generados',
    description: 'Cada vídeo pasa por el worker antes del cliente',
  },
];

export function HumanReviewCard({ brandId, initialConfig }: HumanReviewCardProps) {
  const [config, setConfig] = useState<HumanReviewConfig>(() => ({
    ...DEFAULT,
    ...(initialConfig ?? {}),
  }));
  const [saving, setSaving] = useState<Partial<Record<UiKey, boolean>>>({});

  async function setFlag(key: UiKey, next: boolean) {
    const prev = config[key];
    if (prev === next) return;

    setConfig((c) => ({ ...c, [key]: next }));
    setSaving((s) => ({ ...s, [key]: true }));

    try {
      const res = await fetch(`/api/worker/brands/${brandId}/human-review-config`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: next }),
      });
      const data = await res.json() as { human_review_config?: HumanReviewConfig; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      if (data.human_review_config) setConfig(data.human_review_config);
      toast.success(`Revisión de ${LABEL[key]} ${next ? 'activada' : 'desactivada'}`);
    } catch (err) {
      setConfig((c) => ({ ...c, [key]: prev }));
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
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

      {TOGGLES.map(({ key, title, description }) => (
        <Toggle
          key={key}
          checked={config[key]}
          onChange={(next) => { void setFlag(key, next); }}
          label={title}
          description={description}
          disabled={saving[key] === true}
        />
      ))}

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
