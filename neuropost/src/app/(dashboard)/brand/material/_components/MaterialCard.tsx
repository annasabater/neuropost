'use client';

import { useMemo, useState } from 'react';
import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import { normalizeMaterial, getMaterialStatus, type MaterialStatus } from '@/lib/brand-material/normalize';
import { contentToDisplay } from './display/contentToDisplay';

const f = "var(--font-barlow), 'Barlow', sans-serif";

const STATUS_META: Record<MaterialStatus, { label: string; bg: string; color: string }> = {
  active:    { label: 'Activo',     bg: '#d4f4dd', color: '#1a6b2e' },
  scheduled: { label: 'Programado', bg: '#fef3c7', color: '#92400e' },
  expired:   { label: 'Caducado',   bg: '#e5e7eb', color: '#4b5563' },
  inactive:  { label: 'Inactivo',   bg: '#374151', color: '#f3f4f6' },
};

export function MaterialCard({
  item,
  category,
  deleting,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  item:           BrandMaterial;
  category:       BrandMaterialCategory;
  deleting:       boolean;
  onEdit:         (item: BrandMaterial) => void;
  onDelete:       (id: string) => void;
  onToggleActive?: (id: string, nextActive: boolean) => Promise<boolean>;
}) {
  // Optimistic state: refleja el active actual; se adelanta al PATCH.
  const [optimisticActive, setOptimisticActive] = useState<boolean>(item.active);
  const [toggling,         setToggling]         = useState(false);

  // Mantener sincronía con prop cuando el parent refresca la lista.
  const activeValue = toggling ? optimisticActive : item.active;

  // `now` se fija una sola vez por render — evita flickers en el borde.
  const now = useMemo(() => new Date(), []);

  const status: MaterialStatus = useMemo(() => {
    // Pasamos el item por normalizeMaterial para interpretar active_from/active_to
    // de forma consistente (incluye el fallback active_to ← valid_until).
    const v2 = normalizeMaterial({ ...item, active: activeValue });
    return getMaterialStatus(v2, now);
  }, [item, activeValue, now]);

  const meta = STATUS_META[status];

  async function handleToggle() {
    if (!onToggleActive || toggling) return;
    const next = !activeValue;
    setOptimisticActive(next);
    setToggling(true);
    const ok = await onToggleActive(item.id, next);
    if (!ok) setOptimisticActive(activeValue); // rollback
    setToggling(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contentToDisplay(category, item.content as Record<string, unknown>)}
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {item.valid_until && (
            <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>
              Hasta {new Date(item.valid_until).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
      </div>

      <span
        aria-label={`Estado: ${meta.label}`}
        style={{
          fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '3px 8px',
          background: meta.bg,
          color: meta.color,
          flexShrink: 0,
        }}
      >
        {meta.label}
      </span>

      {onToggleActive && (
        <button
          type="button"
          role="switch"
          aria-checked={activeValue}
          aria-label={activeValue ? 'Desactivar material' : 'Activar material'}
          onClick={handleToggle}
          disabled={toggling}
          style={{
            position: 'relative',
            width: 36, height: 20,
            background: activeValue ? 'var(--accent)' : '#d4d4d8',
            border: 'none',
            cursor: toggling ? 'wait' : 'pointer',
            opacity: toggling ? 0.6 : 1,
            padding: 0,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2, left: activeValue ? 18 : 2,
              width: 16, height: 16,
              background: '#ffffff',
              transition: 'left 0.15s',
            }}
          />
        </button>
      )}

      <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(item)}
          style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(item.id)}
          disabled={deleting}
          style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 12, color: '#ef4444', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}
        >
          {deleting ? '...' : 'Eliminar'}
        </button>
      </div>
    </div>
  );
}
