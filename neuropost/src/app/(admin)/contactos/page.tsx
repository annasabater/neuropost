'use client';

import { useEffect, useState } from 'react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db', green: '#4ade80', yellow: '#facc15', red: '#f87171' };

const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', replied: 'Respondido', closed: 'Cerrado' };
const STATUS_COLORS: Record<string, string> = { pending: A.yellow, replied: A.green, closed: A.muted };

interface ContactRequest {
  id: string;
  name: string;
  email: string;
  business_type: string | null;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function ContactosAdminPage() {
  const [contacts, setContacts]   = useState<ContactRequest[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState<ContactRequest | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(page));
    fetch(`/api/admin/contactos?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setContacts(d.contacts ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [search, statusFilter, page]);

  async function updateStatus(id: string, status: string) {
    await fetch('/api/admin/contactos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : null);
  }

  const pageSize = 25;
  const pages    = Math.ceil(total / pageSize);

  return (
    <div style={{ background: A.bg, minHeight: '100vh', color: A.text, padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '1.5rem', color: A.text, letterSpacing: '-0.03em' }}>Mensajes de contacto</h1>
          <p style={{ color: A.muted, fontSize: '0.85rem', marginTop: 4 }}>{total} mensajes recibidos</p>
        </div>
        <a href="mailto:hola@neuropost.es" style={{ background: A.orange, color: '#fff', padding: '8px 18px', borderRadius: 8, fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
          Redactar respuesta
        </a>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre, email o mensaje..."
          style={{ flex: 1, background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, padding: '8px 14px', color: A.text, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.9rem', outline: 'none' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, padding: '8px 14px', color: statusFilter ? A.text : A.muted, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="replied">Respondido</option>
          <option value="closed">Cerrado</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>

        {/* Table */}
        <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: A.muted, fontFamily: "'Cabinet Grotesk',sans-serif" }}>Cargando...</div>
          ) : contacts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: A.muted, fontFamily: "'Cabinet Grotesk',sans-serif" }}>No hay mensajes</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                  {['Remitente', 'Asunto', 'Negocio', 'Estado', 'Fecha', ''].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.75rem', fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    style={{ borderBottom: `1px solid ${A.border}`, cursor: 'pointer', transition: 'background 0.15s', background: selected?.id === c.id ? 'rgba(255,107,53,0.06)' : 'transparent' }}
                    onMouseEnter={(e) => { if (selected?.id !== c.id) (e.currentTarget as HTMLTableRowElement).style.background = `rgba(255,255,255,0.03)`; }}
                    onMouseLeave={(e) => { if (selected?.id !== c.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 600, fontSize: '0.9rem', color: A.text }}>{c.name}</div>
                      <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', color: A.muted }}>{c.email}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: A.text, maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject ?? c.message.slice(0, 50) + '…'}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: A.muted }}>{c.business_type ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: A.muted }}>{timeAgo(c.created_at)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <select
                        value={c.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateStatus(c.id, e.target.value); }}
                        style={{ background: A.bg, border: `1px solid ${A.border}`, borderRadius: 6, padding: '4px 8px', color: A.text, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="replied">Respondido</option>
                        <option value="closed">Cerrado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px', borderTop: `1px solid ${A.border}` }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${p === page ? A.orange : A.border}`, background: p === page ? A.orange : A.card, color: p === page ? '#fff' : A.text, fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 24, alignSelf: 'start', position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: A.text }}>{selected.name}</div>
                <a href={`mailto:${selected.email}`} style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: A.orange, textDecoration: 'none' }}>{selected.email}</a>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: A.muted, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}>×</button>
            </div>

            {[['Negocio', selected.business_type ?? '—'], ['Asunto', selected.subject ?? '—'], ['Fecha', new Date(selected.created_at).toLocaleString('es-ES')]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', color: A.muted, width: 64, flexShrink: 0, paddingTop: 1 }}>{k}</span>
                <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: A.text }}>{v}</span>
              </div>
            ))}

            <div style={{ background: A.bg, borderRadius: 10, padding: '14px 16px', marginTop: 16, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', color: A.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Mensaje</div>
              <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.88rem', color: A.text, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{selected.message}</p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject ?? 'Tu mensaje en NeuroPost')}`}
                style={{ flex: 1, background: A.orange, color: '#fff', padding: '10px 16px', borderRadius: 8, fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center' }}>
                Responder →
              </a>
              {selected.status !== 'closed' && (
                <button onClick={() => updateStatus(selected.id, 'closed')} style={{ background: A.bg, border: `1px solid ${A.border}`, color: A.muted, padding: '10px 14px', borderRadius: 8, fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                  Cerrar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
