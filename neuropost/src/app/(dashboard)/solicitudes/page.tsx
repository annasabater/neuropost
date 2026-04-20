'use client';

import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, Calendar, Palette, Zap, MessageCircle, FileText } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

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
  { value: 'campaign',     label: 'Campaña completa',     desc: 'Una serie de posts para un período o evento', icon: Calendar },
  { value: 'custom',       label: 'Contenido especial',   desc: 'Posts específicos para algo concreto', icon: Palette },
  { value: 'urgent',       label: 'Urgente',              desc: 'Necesito algo para publicar hoy o mañana', icon: Zap },
  { value: 'consultation', label: 'Consulta',             desc: 'Una pregunta sobre mi estrategia', icon: MessageCircle },
  { value: 'other',        label: 'Otro',                 desc: 'Algo que no encaja en las opciones anteriores', icon: FileText },
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
  const [showDrawer, setShowDrawer] = useState(false);
  const [form, setForm] = useState({ type: 'campaign', title: '', description: '', deadline_at: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const brand = useAppStore((s) => s.brand);
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    fetch('/api/solicitudes').then((r) => r.json()).then((d) => {
      setRequests(d.requests ?? []);
      setLoading(false);
    });
  }, []);

  // Realtime: actualizar cuando el agente responda (worker_response cambia)
  useEffect(() => {
    if (!brand?.id) return;
    const ch = (supabase.channel(`client-solicitudes-${brand.id}`) as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: Request }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'special_requests', filter: `brand_id=eq.${brand.id}` },
      (payload) => {
        const updated = payload.new;
        setRequests(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
        if (updated.worker_response) toast.success('El agente ha respondido a tu solicitud');
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [brand?.id, supabase]);

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
      setShowDrawer(false);
      setForm({ type: 'campaign', title: '', description: '', deadline_at: '', priority: 'normal' });
      toast.success('Solicitud enviada');
    } else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Solicitudes
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>Pídele a tu equipo campañas, contenido especial o cualquier ayuda extra</p>
        </div>
        <button onClick={() => setShowDrawer(true)} style={{
          background: '#111827', color: '#ffffff', border: 'none', padding: '10px 24px',
          fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <Plus size={14} /> Nueva solicitud
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ border: '1px solid #d4d4d8' }}>
          {[1,2,3].map((i) => <div key={i} style={{ padding: '16px 24px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', background: '#ffffff' }}><div style={{ width: '40%', height: 12, background: '#f3f4f6', borderRadius: 2 }} /></div>)}
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Sin solicitudes todavía</p>
          <p style={{ fontSize: 14, color: '#9ca3af', fontFamily: f, marginBottom: 32 }}>Crea tu primera solicitud especial y tu equipo te ayudará</p>
          <button onClick={() => setShowDrawer(true)} style={{
            background: '#111827', color: '#ffffff', border: 'none', padding: '14px 32px',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
          }}>
            Nueva solicitud
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid #d4d4d8' }}>
          {requests.map((req, i) => {
            const st = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            const typeOpt = TYPE_OPTIONS.find((t) => t.value === req.type);
            return (
              <div key={req.id} style={{
                padding: '16px 24px', borderBottom: i < requests.length - 1 ? '1px solid #e5e7eb' : 'none',
                background: '#ffffff', transition: 'background 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: f, fontWeight: 600, fontSize: 14, color: '#111827' }}>{req.title}</span>
                      <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '3px 10px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {st.label}
                      </span>
                    </div>
                    {req.description && <p style={{ color: '#6b7280', fontSize: 13, fontFamily: f, marginBottom: 8, lineHeight: 1.5 }}>{req.description}</p>}
                    {req.worker_response && (
                      <div style={{ background: '#f0fdf4', borderLeft: '2px solid #0F766E', padding: '8px 12px', fontSize: 13, fontFamily: f, color: '#0F766E', marginBottom: 8 }}>
                        Respuesta del equipo: {req.worker_response}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: f, color: '#9ca3af' }}>
                      <span>{new Date(req.created_at).toLocaleDateString('es-ES')}</span>
                      {req.deadline_at && <span>Plazo: {new Date(req.deadline_at).toLocaleDateString('es-ES')}</span>}
                      <span>Tipo: {typeOpt?.label ?? req.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {showDrawer && (
        <>
          <div onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 440,
            background: '#ffffff', zIndex: 51, overflowY: 'auto', padding: 32,
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>Nueva solicitud</h2>
              <button onClick={() => setShowDrawer(false)} title="Cerrar" aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
            </div>

            {/* Type — category cards with icons */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>Tipo de solicitud</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = form.type === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setForm((prev) => ({ ...prev, type: opt.value }))} style={{
                      padding: '10px 12px', background: active ? '#f0fdf4' : '#ffffff',
                      border: `1px solid ${active ? '#0F766E' : '#e5e7eb'}`, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      transition: 'all 0.15s',
                    }}>
                      <Icon size={14} style={{ color: active ? '#0F766E' : '#9ca3af', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: f, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#0F766E' : '#374151', display: 'block' }}>{opt.label}</span>
                        <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', display: 'block', marginTop: 2 }}>{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority toggle */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>Prioridad</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'normal', l: 'Normal' }, { v: 'urgent', l: 'Urgente' }].map((opt) => {
                  const active = form.priority === opt.v;
                  return (
                    <button key={opt.v} onClick={() => setForm((prev) => ({ ...prev, priority: opt.v }))} style={{
                      padding: '8px 20px', border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                      background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#6b7280',
                      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Título *</label>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Resumen breve de tu solicitud"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={PLACEHOLDERS[form.type]} rows={4}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
            </div>

            {/* Deadline */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Fecha límite (opcional)</label>
              <input type="date" value={form.deadline_at} onChange={(e) => setForm((prev) => ({ ...prev, deadline_at: e.target.value }))}
                style={{ padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', color: '#111827' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 1 }}>
              <button onClick={() => setShowDrawer(false)} style={{
                flex: 1, padding: 12, border: '1px solid #d4d4d8', background: '#ffffff',
                fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={submit} disabled={saving} style={{
                flex: 2, padding: 12, border: 'none', background: '#111827', color: '#ffffff',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>{saving ? 'Enviando...' : 'Enviar solicitud →'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
