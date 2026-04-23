'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import { CategoryTabs, type CategoryDef }  from './_components/CategoryTabs';
import { MaterialCard }                    from './_components/MaterialCard';
import { MaterialModal, type AdvancedFields } from './_components/MaterialModal';
import { isContentValidV2 }                from './_components/forms/CategoryForm';
import { detectSchemaVersion }             from '@/types';

const EMPTY_ADVANCED: AdvancedFields = {
  priority:    0,
  platforms:   [],   // columna BD mantenida; no expuesta en UI todavía.
  tags:        [],
  active_from: null,
  active_to:   null,
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// Singular humano por categoría — para el botón contextual y el estado vacío.
const SINGULAR: Record<BrandMaterialCategory, string> = {
  schedule: 'horario',
  promo:    'promoción',
  data:     'servicio',
  quote:    'frase',
  free:     'texto',
};

const CATEGORIES: readonly CategoryDef[] = [
  { id: 'schedule', label: 'Horarios',    desc: 'Horario semanal de apertura',    icon: '🕐' },
  { id: 'promo',    label: 'Promociones', desc: 'Ofertas y campañas activas',     icon: '🎁' },
  { id: 'data',     label: 'Catálogo',    desc: 'Servicios, tratamientos, carta o productos de tu negocio', icon: '📊' },
  { id: 'quote',    label: 'Frases',      desc: 'Citas o lemas de marca',         icon: '💬' },
  { id: 'free',     label: 'Tu marca',    desc: 'Historia, valores y cualquier cosa que defina tu negocio', icon: '✏️' },
] as const;

export default function BrandMaterialPage() {
  const [activeTab, setActiveTab]     = useState<BrandMaterialCategory>('schedule');
  const [items, setItems]             = useState<BrandMaterial[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editingItem, setEditingItem] = useState<BrandMaterial | null>(null);
  const [formContent, setFormContent] = useState<Record<string, unknown>>({});
  const [validUntil, setValidUntil]   = useState('');
  const [advanced,    setAdvanced]    = useState<AdvancedFields>(EMPTY_ADVANCED);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [dirty, setDirty]             = useState(false);

  function patchAdvanced(patch: Partial<AdvancedFields>) {
    setAdvanced(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }

  const fetchItems = useCallback(async (cat: BrandMaterialCategory) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/client/brand-material?category=${cat}`);
      const json = await res.json() as { items?: BrandMaterial[] };
      setItems(json.items ?? []);
    } catch {
      toast.error('No se pudo cargar el material');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(activeTab);
    setShowForm(false);
    setEditingItem(null);
  }, [activeTab, fetchItems]);

  function openNew() {
    setEditingItem(null);
    // Crear entrada nueva siempre nace en v2.
    setFormContent({ schema_version: 2 });
    setValidUntil('');
    setAdvanced(EMPTY_ADVANCED);
    setDirty(false);
    setShowForm(true);
  }

  function openEdit(item: BrandMaterial) {
    setEditingItem(item);
    setFormContent(item.content as Record<string, unknown>);
    setValidUntil(item.valid_until ? item.valid_until.slice(0, 10) : '');
    const anyItem = item as unknown as Partial<AdvancedFields>;
    setAdvanced({
      priority:    anyItem.priority    ?? 0,
      platforms:   anyItem.platforms   ?? [],
      tags:        anyItem.tags        ?? [],
      active_from: anyItem.active_from ?? null,
      active_to:   anyItem.active_to   ?? null,
    });
    setDirty(false);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingItem(null);
    setDirty(false);
  }

  function onFormContentChange(v: Record<string, unknown>) {
    setFormContent(v);
    setDirty(true);
  }

  function onValidUntilChange(v: string) {
    setValidUntil(v);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const url    = editingItem ? `/api/client/brand-material/${editingItem.id}` : '/api/client/brand-material';
      const method = editingItem ? 'PATCH' : 'POST';
      const transversal = {
        priority:    advanced.priority,
        platforms:   advanced.platforms,
        tags:        advanced.tags,
        active_from: advanced.active_from,
        active_to:   advanced.active_to,
      };
      const body = editingItem
        ? { content: formContent, valid_until: validUntil || null, ...transversal }
        : { category: activeTab, content: formContent, valid_until: validUntil || null, ...transversal };

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json() as { item?: BrandMaterial; error?: string; issues?: Array<{ path: (string | number)[]; message: string }> };

      if (!res.ok) {
        toast.error(humanizeApiError(json));
        return;
      }

      if (editingItem) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? json.item! : i));
        toast.success('Actualizado');
      } else {
        setItems(prev => [...prev, json.item!]);
        toast.success('Añadido');
      }
      setShowForm(false);
      setEditingItem(null);
      setDirty(false);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  function humanizeApiError(json: { error?: string; issues?: Array<{ path: (string | number)[]; message: string }> }): string {
    if (json.error === 'invalid_content_shape' && json.issues?.length) {
      const fields = Array.from(new Set(json.issues.map(iss => String(iss.path[0] ?? '')).filter(Boolean))).slice(0, 4);
      if (fields.length > 0) return `Faltan o son inválidos: ${fields.join(', ')}`;
    }
    return json.error ?? 'Error';
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/client/brand-material/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) { toast.error('No se pudo eliminar'); return; }
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Eliminado');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(id: string, nextActive: boolean): Promise<boolean> {
    setItems(prev => prev.map(i => i.id === id ? { ...i, active: nextActive } : i));
    try {
      const res  = await fetch(`/api/client/brand-material/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: nextActive }),
      });
      const json = await res.json() as { item?: BrandMaterial; error?: string };
      if (!res.ok || !json.item) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, active: !nextActive } : i));
        toast.error(json.error ?? 'No se pudo cambiar el estado');
        return false;
      }
      setItems(prev => prev.map(i => i.id === id ? json.item! : i));
      toast.success(nextActive ? 'Material activado' : 'Material desactivado');
      return true;
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, active: !nextActive } : i));
      toast.error('Error de conexión');
      return false;
    }
  }

  const activeDef = CATEGORIES.find(c => c.id === activeTab);
  const singular  = SINGULAR[activeTab];
  const addLabel  = `+ Añadir ${singular}`;

  // Signal no autoritativo de validez para deshabilitar "Guardar" en UI.
  const formVersion = useMemo(() => detectSchemaVersion(formContent), [formContent]);
  const saveDisabled = useMemo(() => {
    if (formVersion === 2) return !isContentValidV2(activeTab, formContent);
    return false;
  }, [formVersion, activeTab, formContent]);

  const addBtnStyle: React.CSSProperties = {
    fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
  };

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 860 }}>

      {/* Header — sin botón global. El botón vive dentro de cada tab. */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 0' }}>
        <div style={{ paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', margin: '0 0 6px' }}>
            Cuéntanos sobre tu negocio
          </p>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.4rem, 5vw, 3.4rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.92, margin: 0 }}>
            Material de Marca
          </h1>
        </div>
      </div>

      <CategoryTabs categories={CATEGORIES} active={activeTab} onChange={setActiveTab} />

      {/* Subtítulo de tab + botón contextual arriba-derecha */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          {activeDef?.desc}
        </p>
        {!loading && items.length > 0 && (
          <button onClick={openNew} style={addBtnStyle}>{addLabel}</button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="loading-spinner" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border)', background: 'var(--bg-1)' }}>
          <p style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Sin entradas
          </p>
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            Aún no has añadido ningún {singular}. Empieza por el primero para que nuestro equipo lo tenga en cuenta al preparar tus publicaciones.
          </p>
          <button onClick={openNew} style={addBtnStyle}>{addLabel}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)' }}>
          {items.map(item => (
            <MaterialCard
              key={item.id}
              item={item}
              category={activeTab}
              deleting={deletingId === item.id}
              onEdit={openEdit}
              onDelete={deleteItem}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      )}

      <MaterialModal
        open={showForm}
        editingItem={editingItem}
        activeCategoryLabel={activeDef?.label ?? ''}
        activeCategory={activeTab}
        formContent={formContent}
        onFormContentChange={onFormContentChange}
        validUntil={validUntil}
        onValidUntilChange={onValidUntilChange}
        advanced={advanced}
        onAdvancedChange={patchAdvanced}
        saving={saving}
        saveDisabled={saveDisabled}
        saveDisabledReason="Completa los campos marcados con *"
        dirty={dirty}
        onCancel={cancelForm}
        onSave={save}
      />
    </div>
  );
}
