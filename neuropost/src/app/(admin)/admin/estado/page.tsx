'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

const SERVICES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'instagram_publishing', label: 'Instagram' },
  { key: 'facebook_publishing', label: 'Facebook' },
  { key: 'image_editing', label: 'Edición imágenes' },
  { key: 'ai_content', label: 'IA / Contenido' },
  { key: 'notifications', label: 'Notificaciones' },
  { key: 'emails', label: 'Emails' },
  { key: 'analytics', label: 'Analíticas' },
];

const SEV_COLOR = { minor: '#713f12', major: '#9a3412', critical: '#7f1d1d' };
const SEV_BG    = { minor: '#fefce8', major: '#fff7ed', critical: '#fef2f2' };
const ST_LABEL  = { investigating: 'Investigando', identified: 'Identificado', monitoring: 'Monitorizando', resolved: 'Resuelto' };

type Incident = any;

export default function AdminEstadoPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]   = useState<Incident | null>(null);
  const [updateMsg, setUpdateMsg] = useState('');
  const [updateStatus, setUpdateStatus] = useState('monitoring');
  const [form, setForm] = useState({ title: '', description: '', severity: 'minor', services: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/status').then((r) => r.json()).then((d) => { setIncidents(d.incidents ?? []); setLoading(false); });
  }, []);

  async function createIncident() {
    if (!form.title.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, description: form.description, severity: form.severity, affected_services: form.services }) });
    const d = await res.json();
    if (res.ok) { setIncidents((prev) => [d.incident, ...prev]); setShowCreate(false); setForm({ title: '', description: '', severity: 'minor', services: [] }); toast.success('Incidencia creada'); }
    else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  async function addUpdate() {
    if (!selected || !updateMsg.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/status/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: updateStatus, message: updateMsg }) });
    const d = await res.json();
    if (res.ok) { setSelected(d.incident); setIncidents((prev) => prev.map((i: any) => i.id === d.incident.id ? d.incident : i)); setUpdateMsg(''); toast.success('Actualización añadida'); }
    else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  async function resolveIncident(id: string) {
    if (!confirm('¿Marcar como resuelta?')) return;
    const res = await fetch(`/api/admin/status/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolve: true, message: 'Incidencia resuelta. El servicio ha vuelto a la normalidad.' }) });
    const d = await res.json();
    if (res.ok) { setIncidents((prev) => prev.map((i: any) => i.id === id ? d.incident : i)); if (selected?.id === id) setSelected(d.incident); toast.success('Resuelta'); }
  }

  const toggleService = (key: string) => setForm((f) => ({ ...f, services: f.services.includes(key) ? f.services.filter((s) => s !== key) : [...f.services, key] }));

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, color: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Estado del servicio</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/estado" target="_blank" style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', textDecoration: 'none', fontWeight: 600 }}>Ver página pública →</a>
          <button onClick={() => setShowCreate(true)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nueva incidencia
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Cargando...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
          <div>
            {incidents.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px 0' }}>✅ Sin incidencias registradas</p> : incidents.map((inc: any) => (
              <div key={inc.id} onClick={() => setSelected(inc)} style={{ background: inc.status === 'resolved' ? '#f9fafb' : '#fff', border: `1px solid ${inc.status === 'resolved' ? '#e5e7eb' : '#fde047'}`, borderRadius: 10, padding: '16px 20px', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{inc.title}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: (SEV_COLOR as any)[inc.severity] ?? '#713f12', background: (SEV_BG as any)[inc.severity] ?? '#fefce8' }}>{inc.severity}</span>
                    {inc.status !== 'resolved' && (
                      <button onClick={(e) => { e.stopPropagation(); resolveIncident(inc.id); }} style={{ fontSize: 11, padding: '2px 10px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
                        ✅ Resolver
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  {(ST_LABEL as any)[inc.status] ?? inc.status} · {new Date(inc.started_at).toLocaleDateString('es-ES')}
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{selected.title}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selected.incident_updates ?? []).map((u: any) => (
                  <div key={u.id} style={{ fontSize: 13, borderLeft: '2px solid #e5e7eb', paddingLeft: 12 }}>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(u.created_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {(ST_LABEL as any)[u.status] ?? u.status}</span>
                    <div style={{ color: '#374151', marginTop: 2 }}>{u.message}</div>
                  </div>
                ))}
              </div>
              {selected.status !== 'resolved' && (
                <>
                  <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, fontSize: 13, outline: 'none' }}>
                    <option value="investigating">Investigando</option>
                    <option value="identified">Identificado</option>
                    <option value="monitoring">Monitorizando</option>
                  </select>
                  <textarea value={updateMsg} onChange={(e) => setUpdateMsg(e.target.value)} rows={3} placeholder="Mensaje de actualización..." style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <button onClick={addUpdate} disabled={!updateMsg.trim() || saving} style={{ marginTop: 8, padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, width: '100%' }}>
                    Añadir actualización
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Nueva incidencia</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Título *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Descripción inicial</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Severidad</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['minor', 'major', 'critical'].map((s) => (
                  <button key={s} onClick={() => setForm((f) => ({ ...f, severity: s }))} style={{ padding: '6px 16px', borderRadius: 8, border: `2px solid ${form.severity === s ? '#ef4444' : '#e5e7eb'}`, background: form.severity === s ? '#fef2f2' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Servicios afectados</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SERVICES.map((svc) => (
                  <button key={svc.key} onClick={() => toggleService(svc.key)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${form.services.includes(svc.key) ? '#ff6b35' : '#e5e7eb'}`, background: form.services.includes(svc.key) ? '#fff8f5' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    {svc.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={createIncident} disabled={saving} style={{ width: '100%', padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {saving ? 'Creando...' : 'Crear incidencia y notificar →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
