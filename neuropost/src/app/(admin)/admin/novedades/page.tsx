'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Trash2 } from 'lucide-react';

type Change = { type: string; text: string };
type Entry = { id: string; version: string | null; title: string; summary: string | null; changes: Change[]; is_published: boolean; published_at: string | null; created_at: string };

const CHANGE_TYPES = [
  { v: 'new',      l: '✨ Nuevo' },
  { v: 'improved', l: '🔧 Mejorado' },
  { v: 'fixed',    l: '🐛 Corregido' },
  { v: 'removed',  l: '🗑 Eliminado' },
];

export default function AdminNovedadesPage() {
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ version: '', title: '', summary: '', changes: [] as Change[] });
  const [newChange, setNewChange] = useState({ type: 'new', text: '' });

  useEffect(() => {
    fetch('/api/admin/changelog').then((r) => r.json()).then((d) => { setEntries(d.entries ?? []); setLoading(false); });
  }, []);

  function addChange() {
    if (!newChange.text.trim()) return;
    setForm((f) => ({ ...f, changes: [...f.changes, { type: newChange.type, text: newChange.text.trim() }] }));
    setNewChange((c) => ({ ...c, text: '' }));
  }

  function removeChange(i: number) {
    setForm((f) => ({ ...f, changes: f.changes.filter((_, idx) => idx !== i) }));
  }

  async function saveEntry(publish: boolean) {
    if (!form.title.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/changelog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, publish }) });
    const d = await res.json();
    if (res.ok) {
      setEntries((prev) => [d.entry, ...prev]);
      setShowCreate(false);
      setForm({ version: '', title: '', summary: '', changes: [] });
      toast.success(publish ? 'Publicado y notificado' : 'Borrador guardado');
    } else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  async function publishEntry(id: string) {
    const res = await fetch(`/api/admin/changelog/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish: true }) });
    const d = await res.json();
    if (res.ok) { setEntries((prev) => prev.map((e) => e.id === id ? d.entry : e)); toast.success('Publicado'); }
    else toast.error(d.error ?? 'Error');
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, color: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Novedades / Changelog</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/novedades" target="_blank" style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', textDecoration: 'none', fontWeight: 600 }}>Ver pública →</a>
          <button onClick={() => setShowCreate(true)} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nueva entrada
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Cargando...</p> : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <div style={{ marginTop: 12 }}>Sin entradas. Crea la primera.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {entry.version && <span style={{ fontSize: 12, fontWeight: 700, color: '#ff6b35', background: '#fff8f5', border: '1px solid #ffcdb5', borderRadius: 6, padding: '1px 8px' }}>v{entry.version}</span>}
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: entry.is_published ? '#065f46' : '#92400e', background: entry.is_published ? '#d1fae5' : '#fef3c7' }}>
                    {entry.is_published ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {Array.isArray(entry.changes) ? `${entry.changes.length} cambios` : '0 cambios'} · {new Date(entry.created_at).toLocaleDateString('es-ES')}
                </div>
              </div>
              {!entry.is_published && (
                <button onClick={() => publishEntry(entry.id)} style={{ padding: '6px 14px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Publicar →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Nueva entrada</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Versión</label>
                <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.3.0" style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Título *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Resumen (para el email)</label>
              <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Cambios</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select value={newChange.type} onChange={(e) => setNewChange((c) => ({ ...c, type: e.target.value }))} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                  {CHANGE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <input value={newChange.text} onChange={(e) => setNewChange((c) => ({ ...c, text: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addChange()} placeholder="Descripción del cambio..." style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                <button onClick={addChange} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {form.changes.map((c, i) => {
                  const conf = CHANGE_TYPES.find((t) => t.v === c.type);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                      <span>{conf?.l ?? c.type}</span>
                      <span style={{ flex: 1 }}>{c.text}</span>
                      <button onClick={() => removeChange(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} color="#9ca3af" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => saveEntry(false)} disabled={saving} style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Guardar borrador
              </button>
              <button onClick={() => saveEntry(true)} disabled={saving} style={{ flex: 2, padding: '12px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                {saving ? 'Publicando...' : '🚀 Publicar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
