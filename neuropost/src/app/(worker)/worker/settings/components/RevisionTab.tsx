'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ChevronDown, ChevronRight, Edit2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Toggle } from '@/components/ui/Toggle';
import { BrandReviewOverrideModal } from './BrandReviewOverrideModal';
import { HARD_DEFAULT, HRC_UI_KEYS, type HrcUiKey } from '@/lib/human-review';
import type { HumanReviewConfig, WorkerRole } from '@/types';

const C = {
  bg:     '#ffffff',
  bg1:    '#f3f4f6',
  card:   '#ffffff',
  border: '#e5e7eb',
  text:   '#111111',
  muted:  '#6b7280',
  accent: '#0F766E',
  red:    '#991b1b',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface BrandEntry {
  id:                  string;
  name:                string;
  human_review_config: Partial<HumanReviewConfig> | null;
  has_override:        boolean;
  effective:           HumanReviewConfig;
  diff_keys:           HrcUiKey[];
}

const LABEL_ES: Record<HrcUiKey, string> = {
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

export default function RevisionTab() {
  const [defaults, setDefaults]   = useState<HumanReviewConfig>(HARD_DEFAULT);
  const [brands, setBrands]       = useState<BrandEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [role, setRole]           = useState<WorkerRole | null>(null);
  const [saving, setSaving]       = useState<Partial<Record<HrcUiKey, boolean>>>({});
  const [showInheriting, setShowInheriting] = useState(false);
  const [modalBrand, setModalBrand] = useState<BrandEntry | null>(null);

  const canEdit = role === 'admin' || role === 'senior';

  const loadAll = useCallback(async () => {
    try {
      const [meRes, brandsRes] = await Promise.all([
        fetch('/api/worker/me'),
        fetch('/api/worker/brands/human-review-config'),
      ]);
      const meData     = await meRes.json().catch(() => ({}));
      const brandsData = await brandsRes.json().catch(() => ({}));
      if (meData?.worker?.role) setRole(meData.worker.role as WorkerRole);
      if (brandsData?.defaults) setDefaults(brandsData.defaults as HumanReviewConfig);
      if (Array.isArray(brandsData?.brands)) setBrands(brandsData.brands as BrandEntry[]);
    } catch {
      toast.error('No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function setGlobalFlag(key: HrcUiKey, next: boolean) {
    if (!canEdit) return;
    const prev = defaults[key];
    if (prev === next) return;

    setDefaults((d) => ({ ...d, [key]: next }));
    setSaving((s) => ({ ...s, [key]: true }));

    try {
      const res = await fetch('/api/worker/settings/human-review-defaults', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [key]: next }),
      });
      const data = await res.json() as { human_review_defaults?: HumanReviewConfig; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      if (data.human_review_defaults) setDefaults(data.human_review_defaults);
      toast.success(`Default global de ${LABEL_ES[key]} ${next ? 'activado' : 'desactivado'}`);
      void loadAll();
    } catch (err) {
      setDefaults((d) => ({ ...d, [key]: prev }));
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function resetBrand(brand: BrandEntry) {
    if (!window.confirm(`¿Resetear revisión humana de "${brand.name}" a herencia?`)) return;
    try {
      const res = await fetch(`/api/worker/brands/${brand.id}/human-review-config`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al resetear');
      toast.success(`${brand.name} vuelve a heredar los defaults globales`);
      void loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo resetear');
    }
  }

  const overridden = brands.filter((b) => b.has_override);
  const inheriting = brands.filter((b) => !b.has_override);

  if (loading) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: f }}>Cargando configuración de revisión…</div>;
  }

  function renderGlobalToggles(list: typeof TOGGLES_CREATE) {
    return list.map(({ key, title, description }) => (
      <Toggle
        key={key}
        checked={defaults[key]}
        onChange={(n) => { void setGlobalFlag(key, n); }}
        label={title}
        description={description}
        disabled={!canEdit || saving[key] === true}
        title={canEdit ? undefined : 'Solo admin/senior'}
      />
    ));
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
    <div style={{ padding: 28, color: C.text, flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: fc }}>
          <ShieldCheck size={22} style={{ color: C.accent }} /> Revisión humana
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0', fontFamily: f }}>
          Defaults globales que aplican a todos los clientes, salvo override por marca.
        </p>
      </div>

      {/* ── Defaults globales ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 24 }}>
        <h4 style={{
          fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12, fontFamily: fc,
        }}>
          Defaults globales
        </h4>

        <div style={sectionHeader}>Al generar ideas (lunes)</div>
        {renderGlobalToggles(TOGGLES_CREATE)}

        <div style={{ ...sectionHeader, marginTop: 16 }}>Al regenerar variaciones</div>
        {renderGlobalToggles(TOGGLES_REGEN)}

        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, fontStyle: 'italic', fontFamily: f }}>
          {canEdit
            ? 'Los cambios se guardan automáticamente'
            : 'Solo admin/senior pueden modificar los defaults'}
        </div>
      </div>

      {/* ── Tabla de overrides ── */}
      <h3 style={{
        fontSize: 14, fontWeight: 800, margin: '0 0 12px', fontFamily: fc,
        textTransform: 'uppercase', letterSpacing: '0.04em', color: C.text,
      }}>
        Clientes con override ({overridden.length})
      </h3>

      {overridden.length === 0 ? (
        <div style={{
          background: C.bg1, border: `1px solid ${C.border}`, padding: 20,
          fontSize: 13, color: C.muted, fontFamily: f, marginBottom: 24,
        }}>
          Ningún cliente tiene override. Todos heredan los defaults globales.
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg1 }}>
                <th style={th}>Cliente</th>
                <th style={th}>Diferencias</th>
                <th style={{ ...th, width: 220, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {overridden.map((b) => (
                <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td, fontWeight: 700 }}>{b.name}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {b.diff_keys.map((k) => {
                        const value = b.effective[k];
                        return (
                          <span key={k} style={{
                            fontSize: 10, padding: '3px 8px',
                            background: value ? C.accent : '#e5e7eb',
                            color:      value ? '#fff'  : C.text,
                            fontFamily: fc, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700,
                          }}>
                            {LABEL_ES[k]} {value ? 'ON' : 'OFF'}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => setModalBrand(b)} style={actionBtn} title="Editar">
                      <Edit2 size={12} /> Editar
                    </button>
                    <button onClick={() => { void resetBrand(b); }} style={{ ...actionBtn, marginLeft: 6 }} title="Resetear a herencia">
                      <RotateCcw size={12} /> Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Expandible: hereda ── */}
      <button
        type="button"
        onClick={() => setShowInheriting((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: C.muted, fontSize: 13, fontFamily: fc, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 0', marginBottom: 8,
        }}
      >
        {showInheriting ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Mostrar clientes que heredan ({inheriting.length})
      </button>

      {showInheriting && (
        <div style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg1 }}>
                <th style={th}>Cliente</th>
                <th style={th}>Config efectiva (hereda)</th>
                <th style={{ ...th, width: 160, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inheriting.length === 0 ? (
                <tr><td colSpan={3} style={{ ...td, color: C.muted, textAlign: 'center' }}>No hay clientes heredando.</td></tr>
              ) : (
                inheriting.map((b) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.name}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {HRC_UI_KEYS.map((k) => {
                          const value = b.effective[k];
                          return (
                            <span key={k} style={{
                              fontSize: 10, padding: '3px 8px',
                              background: C.bg1, color: C.muted,
                              fontFamily: fc, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700,
                            }}>
                              {LABEL_ES[k]} {value ? 'ON' : 'OFF'}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setModalBrand(b)} style={actionBtn} title="Editar">
                        <Edit2 size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalBrand && (
        <BrandReviewOverrideModal
          brand={{
            id:                  modalBrand.id,
            name:                modalBrand.name,
            human_review_config: modalBrand.human_review_config,
          }}
          defaults={defaults}
          onClose={() => setModalBrand(null)}
          onSaved={() => { void loadAll(); }}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fc,
};
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13, fontFamily: f,
};
const actionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', background: 'transparent', color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer',
  fontSize: 11, fontFamily: fc, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
