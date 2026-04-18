'use client';

import { useEffect, useState } from 'react';
import { Trash2, Edit2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#dc2626',
  orange: '#f59e0b',
  green: '#10b981',
};

type WorkerRole = 'admin' | 'supervisor' | 'agent';

interface PortalWorker {
  id: string;
  user_id: string;
  role: WorkerRole;
  email: string;
  name: string;
  is_active: boolean;
  added_at: string;
}

const ROLE_COLORS: Record<WorkerRole, string> = {
  admin: C.red,
  supervisor: C.orange,
  agent: C.green,
};

const ROLE_LABELS: Record<WorkerRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  agent: 'Agente',
};

export default function EquipoTab() {
  const [workers, setWorkers] = useState<PortalWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'agent' as WorkerRole });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<WorkerRole>('agent');

  // Cargar trabajadores
  useEffect(() => {
    fetchWorkers();
  }, []);

  async function fetchWorkers() {
    try {
      setLoading(true);
      const res = await fetch('/api/worker/team');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch (err) {
      toast.error('Error al cargar trabajadores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!form.email.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/worker/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerEmail: form.email.trim(), role: form.role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error adding worker');
      }
      toast.success('Trabajador añadido');
      setForm({ email: '', role: 'agent' });
      setShowModal(false);
      await fetchWorkers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error adding worker');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(workerId: string, newRole: WorkerRole) {
    try {
      const res = await fetch(`/api/worker/team/${workerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Error updating role');
      toast.success('Rol actualizado');
      setEditingId(null);
      await fetchWorkers();
    } catch (err) {
      toast.error('Error updating role');
    }
  }

  async function handleDelete(workerId: string) {
    if (!confirm('¿Eliminar este trabajador?')) return;
    try {
      const res = await fetch(`/api/worker/team/${workerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting worker');
      toast.success('Trabajador eliminado');
      await fetchWorkers();
    } catch (err) {
      toast.error('Error deleting worker');
    }
  }

  return (
    <div style={{ fontFamily: f }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Gestión del Equipo</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 16px',
            background: C.accent2,
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + Añadir Trabajador
        </button>
      </div>

      {/* Loading */}
      {loading && <p style={{ color: C.muted }}>Cargando...</p>}

      {/* Workers Table */}
      {!loading && workers.length > 0 && (
        <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg1, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.muted }}>Nombre</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.muted }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.muted }}>Rol</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.muted }}>Añadido</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: C.muted }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', color: C.text }}>{w.name}</td>
                  <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>{w.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {editingId === w.id ? (
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value as WorkerRole)}
                        onBlur={() => handleRoleChange(w.id, editingRole)}
                        autoFocus
                        style={{
                          padding: '6px 8px',
                          background: C.bg1,
                          border: `1px solid ${C.border}`,
                          borderRadius: 0,
                          color: C.text,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          background: ROLE_COLORS[w.role],
                          color: '#fff',
                          borderRadius: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setEditingId(w.id);
                          setEditingRole(w.role);
                        }}
                      >
                        {ROLE_LABELS[w.role]}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>
                    {new Date(w.added_at).toLocaleDateString('es-ES')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(w.email);
                        toast.success('Email copiado');
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        borderRadius: 0,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: C.muted,
                      }}
                      title="Copiar email"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.red}`,
                        borderRadius: 0,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: C.red,
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && workers.length === 0 && (
        <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0' }}>No hay trabajadores en el equipo</p>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              padding: 32,
              width: 420,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>Añadir Trabajador</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6 }}>
                Email del trabajador
              </label>
              <input
                type="email"
                placeholder="trabajador@neuropost.app"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6 }}>
                Rol
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as WorkerRole }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontSize: 13,
                }}
              >
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: C.accent2,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 0,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Añadiendo...' : 'Añadir Trabajador'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '12px 16px',
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
