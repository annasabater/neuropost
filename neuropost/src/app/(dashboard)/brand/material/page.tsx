'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { BrandMaterial, BrandMaterialCategory } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const CATEGORIES: { id: BrandMaterialCategory; label: string; desc: string; icon: string }[] = [
  { id: 'schedule', label: 'Horarios',     desc: 'Horario semanal de apertura',         icon: '🕐' },
  { id: 'promo',    label: 'Promociones',  desc: 'Ofertas y campañas activas',           icon: '🎁' },
  { id: 'data',     label: 'Datos',        desc: 'Cifras y logros de tu negocio',        icon: '📊' },
  { id: 'quote',    label: 'Frases',       desc: 'Citas o lemas de marca',              icon: '💬' },
  { id: 'free',     label: 'Libre',        desc: 'Cualquier texto para alimentar la IA', icon: '✏️' },
];

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_VALUES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type DayHour = { day: string; hours: string };

// ─── Helpers to build form state from content ────────────────────────────────

function emptyForm(cat: BrandMaterialCategory): Record<string, unknown> {
  if (cat === 'schedule') return { days: [] as DayHour[] };
  if (cat === 'promo')    return { title: '', description: '', url: '' };
  if (cat === 'data')     return { label: '', description: '' };
  if (cat === 'quote')    return { text: '', author: '' };
  return { text: '' };
}

function contentToDisplay(cat: BrandMaterialCategory, content: Record<string, unknown>): string {
  if (cat === 'schedule') {
    const days = (content.days as DayHour[] | undefined) ?? [];
    if (!days.length) return 'Sin días configurados';
    return days.map(d => `${d.day}: ${d.hours}`).join(', ');
  }
  if (cat === 'promo')  return (content.title as string) || '—';
  if (cat === 'data')   return `${content.label ?? ''}${content.description ? ` — ${content.description}` : ''}`;
  if (cat === 'quote')  return (content.text as string) || '—';
  return (content.text as string) || '—';
}

// ─── Form components per category ────────────────────────────────────────────

function ScheduleForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const days = (value.days as DayHour[]) ?? [];

  function setDay(dayVal: string, hours: string) {
    const existing = days.find(d => d.day === dayVal);
    if (existing) {
      onChange({ days: days.map(d => d.day === dayVal ? { ...d, hours } : d) });
    } else {
      onChange({ days: [...days, { day: dayVal, hours }] });
    }
  }

  function toggleDay(dayVal: string, checked: boolean) {
    if (checked) {
      if (!days.find(d => d.day === dayVal)) {
        onChange({ days: [...days, { day: dayVal, hours: '9:00-20:00' }] });
      }
    } else {
      onChange({ days: days.filter(d => d.day !== dayVal) });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS_ES.map((label, i) => {
        const dayVal = DAY_VALUES[i];
        const entry  = days.find(d => d.day === dayVal);
        return (
          <div key={dayVal} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 110 }}>
              <input
                type="checkbox"
                checked={!!entry}
                onChange={e => toggleDay(dayVal, e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
              />
              <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
            </label>
            {entry && (
              <input
                value={entry.hours}
                onChange={e => setDay(dayVal, e.target.value)}
                placeholder="9:00-20:00"
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PromoForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Título *</label>
        <input value={(value.title as string) ?? ''} onChange={e => set('title', e.target.value)} placeholder="Ej: 20% en toda la carta este fin de semana" style={inputStyle} />
      </div>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Descripción</label>
        <textarea value={(value.description as string) ?? ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Detalles de la promo..." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>URL (opcional)</label>
        <input value={(value.url as string) ?? ''} onChange={e => set('url', e.target.value)} placeholder="https://..." style={inputStyle} />
      </div>
    </div>
  );
}

function DataForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Cifra / dato *</label>
        <input value={(value.label as string) ?? ''} onChange={e => set('label', e.target.value)} placeholder="Ej: 15 años" style={inputStyle} />
      </div>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Contexto *</label>
        <input value={(value.description as string) ?? ''} onChange={e => set('description', e.target.value)} placeholder="Ej: de experiencia en el sector" style={inputStyle} />
      </div>
    </div>
  );
}

function QuoteForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Frase *</label>
        <textarea value={(value.text as string) ?? ''} onChange={e => set('text', e.target.value)} rows={3} placeholder="Ej: La artesanía no se improvisa, se cultiva." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Autor (opcional)</label>
        <input value={(value.author as string) ?? ''} onChange={e => set('author', e.target.value)} placeholder="Ej: María García, fundadora" style={inputStyle} />
      </div>
    </div>
  );
}

function FreeForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)', boxSizing: 'border-box' };
  return (
    <div>
      <label style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Texto *</label>
      <textarea
        value={(value.text as string) ?? ''}
        onChange={e => onChange({ text: e.target.value })}
        rows={5}
        placeholder="Escribe cualquier información relevante de tu marca que quieras que los agentes tengan en cuenta..."
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </div>
  );
}

function CategoryForm({ cat, value, onChange }: { cat: BrandMaterialCategory; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  if (cat === 'schedule') return <ScheduleForm value={value} onChange={onChange} />;
  if (cat === 'promo')    return <PromoForm    value={value} onChange={onChange} />;
  if (cat === 'data')     return <DataForm     value={value} onChange={onChange} />;
  if (cat === 'quote')    return <QuoteForm    value={value} onChange={onChange} />;
  return <FreeForm value={value} onChange={onChange} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrandMaterialPage() {
  const [activeTab, setActiveTab]   = useState<BrandMaterialCategory>('schedule');
  const [items, setItems]           = useState<BrandMaterial[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editingItem, setEditingItem] = useState<BrandMaterial | null>(null);
  const [formContent, setFormContent] = useState<Record<string, unknown>>(emptyForm('schedule'));
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(async (cat: BrandMaterialCategory) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/client/brand-material?category=${cat}`);
      const json = await res.json() as { items?: BrandMaterial[] };
      setItems(json.items ?? []);
    } catch {
      toast.error('Error al cargar el material');
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
    setFormContent(emptyForm(activeTab));
    setValidUntil('');
    setShowForm(true);
  }

  function openEdit(item: BrandMaterial) {
    setEditingItem(item);
    setFormContent(item.content as Record<string, unknown>);
    setValidUntil(item.valid_until ? item.valid_until.slice(0, 10) : '');
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingItem(null);
  }

  async function save() {
    setSaving(true);
    try {
      if (editingItem) {
        const res  = await fetch(`/api/client/brand-material/${editingItem.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: formContent, valid_until: validUntil || null }),
        });
        const json = await res.json() as { item?: BrandMaterial; error?: string };
        if (!res.ok) { toast.error(json.error ?? 'Error'); return; }
        setItems(prev => prev.map(i => i.id === editingItem.id ? json.item! : i));
        toast.success('Actualizado');
      } else {
        const res  = await fetch('/api/client/brand-material', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ category: activeTab, content: formContent, valid_until: validUntil || null }),
        });
        const json = await res.json() as { item?: BrandMaterial; error?: string };
        if (!res.ok) { toast.error(json.error ?? 'Error'); return; }
        setItems(prev => [...prev, json.item!]);
        toast.success('Añadido');
      }
      setShowForm(false);
      setEditingItem(null);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/client/brand-material/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) { toast.error('Error al eliminar'); return; }
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Eliminado');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  }

  const labelSt: React.CSSProperties = { fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 860 }}>

      {/* Header */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 8 }}>
            Material de Marca
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Contenido que alimenta el generador de historias y posts
          </p>
        </div>
        <button
          onClick={openNew}
          style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Añadir
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 0 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            style={{
              padding: '12px 20px',
              fontFamily: fc,
              fontWeight: 700,
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: 'none',
              borderBottom: activeTab === cat.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              color: activeTab === cat.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Section description */}
      <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        {CATEGORIES.find(c => c.id === activeTab)?.desc}
      </p>

      {/* Item list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="loading-spinner" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border)', background: 'var(--bg-1)' }}>
          <p style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Sin entradas
          </p>
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Añade {CATEGORIES.find(c => c.id === activeTab)?.label.toLowerCase()} para que los agentes puedan crear historias relevantes.
          </p>
          <button onClick={openNew} style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            + Añadir primera entrada
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)' }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contentToDisplay(activeTab, item.content as Record<string, unknown>)}
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {item.valid_until && (
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)' }}>
                      Hasta {new Date(item.valid_until).toLocaleDateString('es-ES')}
                    </span>
                  )}
                  <span style={{
                    fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '2px 8px',
                    background: item.active ? '#dcfce7' : '#f3f4f6',
                    color: item.active ? '#15803d' : '#9ca3af',
                  }}>
                    {item.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 1 }}>
                <button
                  onClick={() => openEdit(item)}
                  style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  disabled={deletingId === item.id}
                  style={{ padding: '6px 14px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 12, color: '#ef4444', cursor: 'pointer', opacity: deletingId === item.id ? 0.5 : 1 }}
                >
                  {deletingId === item.id ? '...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Form panel ── */}
      {showForm && (
        <>
          <div onClick={cancelForm} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '50%', maxWidth: 520,
            background: 'var(--bg-1)', zIndex: 51, overflowY: 'auto',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                {editingItem ? 'Editar entrada' : `Nueva entrada · ${CATEGORIES.find(c => c.id === activeTab)?.label}`}
              </h2>
              <button onClick={cancelForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <CategoryForm cat={activeTab} value={formContent} onChange={setFormContent} />

              {/* Valid until — optional for promo */}
              <div>
                <label style={labelSt}>Válido hasta (opcional)</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={cancelForm} style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Añadir entrada'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
