'use client';

import React from 'react';
import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import type { BrandMaterialV2 } from '@/types/brand-material';
import { normalizeMaterial } from '@/lib/brand-material/normalize';
import { formatMaterialItem } from '@/lib/agents/strategy/context-blocks';
import { CategoryForm }     from './forms/CategoryForm';
import { Collapsible, ChipsInput, isoToLocalInput, localInputToIso } from './forms/_v2/shared';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'x',         label: 'X' },
];

export interface AdvancedFields {
  priority:    number;
  platforms:   string[];
  tags:        string[];
  active_from: string | null;
  active_to:   string | null;
}

interface DrawerProps {
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
  onCancel:             () => void;
  onSave:               () => void;
}

export function MaterialDrawer(props: DrawerProps) {
  const {
    open, editingItem, activeCategoryLabel, activeCategory,
    formContent, onFormContentChange,
    validUntil, onValidUntilChange,
    advanced, onAdvancedChange,
    saving, saveDisabled, saveDisabledReason,
    onCancel, onSave,
  } = props;

  if (!open) return null;

  const disabled = saving || !!saveDisabled;
  const labelSt: React.CSSProperties = { fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const helpSt:  React.CSSProperties = { fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 };

  // ── Preview del contexto IA ──
  // Ensambla un BrandMaterialV2 virtual con el estado actual del drawer.
  // Si formContent es v1, lo normaliza antes para que la preview muestre
  // exactamente lo que verán los agentes.
  const now = new Date();
  let previewText = '';
  try {
    const tmpRow: BrandMaterial = {
      id:            editingItem?.id            ?? 'preview',
      brand_id:      editingItem?.brand_id      ?? '',
      category:      activeCategory,
      content:       formContent,
      active:        editingItem?.active        ?? true,
      valid_until:   validUntil ? new Date(validUntil).toISOString() : null,
      display_order: editingItem?.display_order ?? 0,
      created_at:    editingItem?.created_at    ?? now.toISOString(),
      updated_at:    editingItem?.updated_at    ?? now.toISOString(),
    };
    // Mezclamos los campos transversales que el usuario está editando.
    const normalized: BrandMaterialV2 = {
      ...normalizeMaterial(tmpRow),
      priority:    advanced.priority,
      platforms:   advanced.platforms,
      tags:        advanced.tags,
      active_from: advanced.active_from,
      active_to:   advanced.active_to,
    };
    const line = formatMaterialItem(normalized, now);
    previewText = line ?? '(Rellena los campos requeridos para ver la vista previa)';
  } catch {
    previewText = '(Rellena los campos requeridos para ver la vista previa)';
  }

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '50%', maxWidth: 520,
        background: 'var(--bg-1)', zIndex: 51, overflowY: 'auto',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {editingItem ? 'Editar entrada' : `Nueva entrada · ${activeCategoryLabel}`}
          </h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            {/* Prioridad */}
            <div>
              <label style={labelSt}>Prioridad: {advanced.priority}</label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={advanced.priority}
                onChange={e => onAdvancedChange({ priority: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <p style={helpSt}>Materiales con mayor prioridad se muestran primero en el contexto de la IA.</p>
            </div>

            {/* Plataformas */}
            <div>
              <label style={labelSt}>Plataformas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PLATFORM_OPTIONS.map(opt => {
                  const active = advanced.platforms.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? advanced.platforms.filter(p => p !== opt.value)
                          : [...advanced.platforms, opt.value];
                        onAdvancedChange({ platforms: next });
                      }}
                      style={{
                        padding: '6px 12px',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : 'var(--bg)',
                        color:      active ? '#fff' : 'var(--text-primary)',
                        fontFamily: f, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {advanced.platforms.length === 0 && (
                <p style={helpSt}>Sin seleccionar: el material aplica a todas las plataformas.</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={labelSt}>Etiquetas</label>
              <ChipsInput
                value={advanced.tags}
                onChange={tags => onAdvancedChange({ tags })}
                placeholder="seasonal, premium, kids..."
              />
              <p style={helpSt}>Etiquetas libres. Enter o coma para añadir.</p>
            </div>

            {/* Ventana de vigencia */}
            <div>
              <label style={labelSt}>Ventana de vigencia</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelSt, fontSize: 10, marginBottom: 2 }}>Activo desde</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(advanced.active_from ?? undefined)}
                    onChange={e => onAdvancedChange({ active_from: localInputToIso(e.target.value) ?? null })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelSt, fontSize: 10, marginBottom: 2 }}>Activo hasta</label>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(advanced.active_to ?? undefined)}
                    onChange={e => onAdvancedChange({ active_to: localInputToIso(e.target.value) ?? null })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p style={helpSt}>Si dejas vacío, el material está vigente sin restricción temporal.</p>
            </div>
          </Collapsible>

          {/* ── Vista previa del contexto IA ── */}
          <Collapsible title="Vista previa del contexto IA">
            <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
              Así verá la IA este material al generar posts. El bloque completo incluye también los demás materiales activos de tu marca.
            </p>
            <pre style={{
              background: '#f5f5f5',
              border: '1px solid var(--border)',
              padding: '10px 14px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              color: '#111827',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              {previewText}
            </pre>
          </Collapsible>
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={disabled}
            title={saveDisabled && !saving ? (saveDisabledReason ?? 'Completa los campos marcados con *') : undefined}
            style={{
              flex: 2, padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none',
              fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            }}
          >
            {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Añadir entrada'}
          </button>
        </div>
      </div>
    </>
  );
}
