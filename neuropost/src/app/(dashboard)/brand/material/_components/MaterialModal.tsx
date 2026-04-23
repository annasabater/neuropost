'use client';

import React, { useEffect, useRef } from 'react';
import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import { CategoryForm }     from './forms/CategoryForm';
import { Collapsible, ChipsInput, isoToLocalInput, localInputToIso } from './forms/_v2/shared';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface AdvancedFields {
  priority:    number;
  platforms:   string[];   // mantenido en el estado para el body del API; no expuesto en UI.
  tags:        string[];
  active_from: string | null;
  active_to:   string | null;
}

interface ModalProps {
  open:                 boolean;
  editingItem:          BrandMaterial | null;
  activeCategoryLabel:  string;
  activeCategory:       BrandMaterialCategory;
  formContent:          Record<string, unknown>;
  onFormContentChange:  (v: Record<string, unknown>) => void;
  validUntil:           string;
  onValidUntilChange:   (v: string) => void;
  advanced:             AdvancedFields;
  onAdvancedChange:     (patch: Partial<AdvancedFields>) => void;
  saving:               boolean;
  saveDisabled?:        boolean;
  saveDisabledReason?:  string;
  dirty?:               boolean;
  onCancel:             () => void;
  onSave:               () => void;
}

// Escala humana para el slider "Destaque".
function highlightLabel(v: number): string {
  if (v <= 2) return 'Normal';
  if (v <= 5) return 'Destacado';
  if (v <= 8) return 'Muy destacado';
  return 'Prioritario';
}

export function MaterialModal(props: ModalProps) {
  const {
    open, editingItem, activeCategoryLabel, activeCategory,
    formContent, onFormContentChange,
    validUntil, onValidUntilChange,
    advanced, onAdvancedChange,
    saving, saveDisabled, saveDisabledReason, dirty,
    onCancel, onSave,
  } = props;

  const modalRef = useRef<HTMLDivElement>(null);
  const titleId  = 'material-modal-title';

  // Cerrado con guard de cambios sin guardar
  function requestClose() {
    if (dirty) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Tienes cambios sin guardar. ¿Descartar?')
        : true;
      if (!ok) return;
    }
    onCancel();
  }

  // ESC + focus trap + focus inicial
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0]!;
        const last  = list[list.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);

    // Focus inicial en el primer elemento focuseable.
    const t = window.setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button',
      );
      first?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  if (!open) return null;

  const disabled = saving || !!saveDisabled;
  const labelSt: React.CSSProperties = { fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const helpSt:  React.CSSProperties = { fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 };

  return (
    <div
      onClick={requestClose}
      role="presentation"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        style={{
          width:        'min(720px, calc(100vw - 48px))',
          maxHeight:    'calc(100vh - 80px)',
          background:   'var(--bg)',
          borderRadius: 4,
          boxShadow:    '0 20px 40px rgba(0,0,0,0.15)',
          display:      'flex',
          flexDirection: 'column',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2
            id={titleId}
            style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}
          >
            {editingItem ? 'Editar entrada' : `Nueva entrada · ${activeCategoryLabel}`}
          </h2>
          <button
            onClick={requestClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <CategoryForm cat={activeCategory} value={formContent} onChange={onFormContentChange} />

          <div>
            <label style={labelSt}>Válido hasta (opcional)</label>
            <input
              type="date"
              value={validUntil}
              onChange={e => onValidUntilChange(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* ── Opciones avanzadas ── */}
          <Collapsible title="Opciones avanzadas">
            {/* Destaque */}
            <div>
              <label style={labelSt}>
                Destaque: {advanced.priority} — {highlightLabel(advanced.priority)}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={advanced.priority}
                onChange={e => onAdvancedChange({ priority: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <p style={helpSt}>
                Si quieres que nuestro equipo tenga especialmente en cuenta este material, súbele el destaque. Los materiales con más destaque aparecerán con más frecuencia en tus publicaciones.
              </p>
            </div>

            {/* Etiquetas internas */}
            <div>
              <label style={labelSt}>Etiquetas internas (opcional)</label>
              <ChipsInput
                value={advanced.tags}
                onChange={tags => onAdvancedChange({ tags })}
                placeholder="verano, premium, fin de semana..."
              />
              <p style={helpSt}>
                Palabras clave para que nuestro equipo organice tus materiales por temas (ejemplo: verano, premium, fin de semana). Enter o coma para añadir.
              </p>
            </div>

            {/* Fechas de vigencia */}
            <div>
              <label style={labelSt}>Fechas de vigencia (opcional)</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelSt, fontSize: 10, marginBottom: 2 }}>Empezar a usar desde</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(advanced.active_from ?? undefined)}
                    onChange={e => onAdvancedChange({ active_from: localInputToIso(e.target.value) ?? null })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelSt, fontSize: 10, marginBottom: 2 }}>Dejar de usar a partir de</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(advanced.active_to ?? undefined)}
                    onChange={e => onAdvancedChange({ active_to: localInputToIso(e.target.value) ?? null })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p style={helpSt}>
                Útil para promociones con fecha de caducidad (Black Friday, rebajas de verano) o para horarios de temporada. Si dejas ambos vacíos, el material está siempre disponible. Los materiales fuera de sus fechas aparecerán como &quot;PROGRAMADO&quot; o &quot;CADUCADO&quot; en la lista.
              </p>
            </div>
          </Collapsible>
        </div>

        {/* Footer sticky */}
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          padding: '16px 24px',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            onClick={requestClose}
            style={{ padding: '10px 20px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={disabled}
            title={saveDisabled && !saving ? (saveDisabledReason ?? 'Completa los campos marcados con *') : undefined}
            style={{
              padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none',
              fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            }}
          >
            {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Añadir entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}
