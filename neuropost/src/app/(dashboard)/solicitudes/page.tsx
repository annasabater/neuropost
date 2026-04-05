'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

type Request = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  worker_response: string | null;
  deadline_at: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendiente',   color: '#92400e', bg: '#fef3c7' },
  accepted:    { label: 'Aceptada',    color: '#1d4ed8', bg: '#dbeafe' },
  in_progress: { label: 'En proceso',  color: '#c2410c', bg: '#ffedd5' },
  completed:   { label: 'Completada',  color: '#065f46', bg: '#d1fae5' },
  rejected:    { label: 'Rechazada',   color: '#991b1b', bg: '#fee2e2' },
};

const TYPE_OPTIONS = [
  { value: 'campaign',     label: '📅 Campaña completa',     desc: 'Una serie de posts para un período o evento' },
  { value: 'custom',       label: '🎨 Contenido especial',   desc: 'Posts específicos para algo concreto' },
  { value: 'urgent',       label: '⚡ Urgente',              desc: 'Necesito algo para publicar hoy o mañana' },
  { value: 'consultation', label: '💬 Consulta',             desc: 'Una pregunta sobre mi estrategia' },
  { value: 'other',        label: '📝 Otro',                 desc: 'Algo que no encaja en las opciones anteriores' },
];

const PLACEHOLDERS: Record<string, string> = {
  campaign: 'Ej: Campaña de verano con 8 posts, del 1 al 31 de julio. Quiero promocionar nuestros sabores especiales de temporada.',
  urgent: 'Ej: Necesito un post para hoy a las 18h anunciando que abrimos terraza.',
  custom: 'Ej: Quiero 3 posts presentando nuestro nuevo menú de otoño.',
  consultation: 'Ej: ¿Debería publicar más stories o más posts en el feed?',
  other: 'Describe tu solicitud con el máximo detalle posible.',
};

export default function SolicitudesPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: 'campaign', title: '', description: '', deadline_at: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/solicitudes').then((r) => r.json()).then((d) => {
      setRequests(d.requests ?? []);
      setLoading(false);
    });
  }, []);

  async function submit() {
    if (!form.title.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);
    const res = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, deadline_at: form.deadline_at || null }),
    });
    const d = await res.json();
    if (res.ok) {
      setRequests((prev) => [d.request, ...prev]);
      setShowModal(false);
      setForm({ type: 'campaign', title: '', description: '', deadline_at: '' });
      toast.success('Solicitud enviada');
    } else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Solicitudes especiales</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Pídele a tu equipo campañas, contenido especial o cualquier ayuda extra</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Plus size={16} /> Nueva solicitud
        </button>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Cargando...</p> : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 56 }}>📝</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 16 }}>Sin solicitudes todavía</div>
          <div style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>Crea tu primera solicitud especial y tu equipo te ayudará</div>
          <button onClick={() => setShowModal(true)} style={{ marginTop: 20, background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
            + Nueva solicitud
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((req) => {
            const st = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            return (
              <div key={req.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{req.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                    </div>
                    {req.description && <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{req.description}</p>}
                    {req.worker_response && (
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0369a1', marginBottom: 8 }}>
                        💬 Respuesta del equipo: {req.worker_response}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
                      <span>📅 {new Date(req.created_at).toLocaleDateString('es-ES')}</span>
                      {req.deadline_at && <span>⏰ Plazo: {new Date(req.deadline_at).toLocaleDateString('es-ES')}</span>}
                      <span>Tipo: {TYPE_OPTIONS.find((t) => t.value === req.type)?.label ?? req.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Nueva solicitud</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#6b7280" />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Tipo de solicitud</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `2px solid ${form.type === opt.value ? '#ff6b35' : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', background: form.type === opt.value ? '#fff8f5' : '#fff' }}>
                    <input type="radio" name="type" value={opt.value} checked={form.type === opt.value} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ display: 'none' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Título *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Resumen breve de tu solicitud" style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={PLACEHOLDERS[form.type]} rows={4} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Fecha límite (opcional)</label>
              <input type="date" value={form.deadline_at} onChange={(e) => setForm((f) => ({ ...f, deadline_at: e.target.value }))} style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '12px', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {saving ? 'Enviando...' : 'Enviar solicitud →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
