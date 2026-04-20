'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Worker, WorkerRole } from '@/types';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
};

const ROLES: WorkerRole[] = ['worker', 'senior', 'admin'];

export default function TrabajadoresAdminPage() {
  const [workers, setWorkers]   = useState<Worker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setModal]   = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'worker' as WorkerRole });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/worker/trabajadores').then((r) => r.json()).then((d) => {
      setWorkers(d.workers ?? []);
      setLoading(false);
    });
  }, []);

  async function handleToggle(w: Worker) {
    const res = await fetch('/api/worker/trabajadores', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, is_active: !w.is_active }),
    });
    if (res.ok) {
      setWorkers((prev) => prev.map((x) => x.id === w.id ? { ...x, is_active: !w.is_active } : x));
      toast.success('Actualizado');
    }
  }

  async function handleCreate() {
    if (!form.email || !form.full_name) { toast.error('Completa todos los campos'); return; }
    setSaving(true);
    const res = await fetch('/api/worker/trabajadores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setWorkers((prev) => [json.worker, ...prev]);
      setModal(false);
      setForm({ email: '', full_name: '', role: 'worker' });
      toast.success('Trabajador creado');
    } else {
      toast.error(json.error ?? 'Error');
    }
    setSaving(false);
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Gestión de trabajadores</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>{workers.length} trabajadores registrados</p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding: '10px 20px', background: C.accent2, color: '#fff', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          + Añadir trabajador
        </button>
      </div>

      {loading ? <p style={{ color: C.muted }}>Cargando...</p> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg1 }}>
                {['Trabajador', 'Email', 'Rol', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {(w.full_name ?? 'W').charAt(0)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{w.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.muted }}>{w.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', padding: '3px 8px', borderRadius: 0, background: w.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: w.role === 'admin' ? C.red : C.accent2 }}>
                      {w.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => handleToggle(w)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 0, cursor: 'pointer', background: w.is_active ? 'rgba(20,184,166,0.1)' : 'rgba(239,68,68,0.1)', color: w.is_active ? C.green : C.red, border: 'none' }}>
                      {w.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={w.role}
                      onChange={async (e) => {
                        const res = await fetch('/api/worker/trabajadores', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, role: e.target.value }) });
                        if (res.ok) { setWorkers((prev) => prev.map((x) => x.id === w.id ? { ...x, role: e.target.value as WorkerRole } : x)); toast.success('Rol actualizado'); }
                      }}
                      style={{ padding: '4px 8px', background: C.bg1, border: `1px solid ${C.border}`, color: C.text, borderRadius: 0, fontSize: 12 }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 32, width: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>Añadir trabajador</h2>
            {[
              { label: 'Nombre completo', key: 'full_name', type: 'text', placeholder: 'Ana García' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'ana@neuropost.app' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6 }}>{label}</label>
                <input type={type} placeholder={placeholder} value={form[key as 'email' | 'full_name']} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 0, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6 }}>Rol</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as WorkerRole }))} style={{ width: '100%', padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 0, color: C.text, fontSize: 13 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 1, padding: '12px', background: C.accent2, color: '#fff', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creando...' : 'Crear trabajador'}
              </button>
              <button onClick={() => setModal(false)} style={{ padding: '12px 16px', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 0, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
