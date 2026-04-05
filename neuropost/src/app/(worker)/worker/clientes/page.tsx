'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

type Client = {
  id: string; name: string; sector: string | null; plan: string;
  ig_username: string | null; pending_in_queue: number; created_at: string;
};

const PLAN_COLOR: Record<string, string> = { starter: '#6b7280', pro: '#3b82f6', total: '#8b5cf6', agency: '#f59e0b' };

export default function ClientesPage() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [search, setSearch]     = useState('');
  const [planFilter, setPlan]   = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/worker/clientes').then((r) => r.json()).then((d) => {
      setClients(d.clients ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.ig_username?.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = !planFilter || c.plan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: W.text, marginBottom: 4 }}>Todos los clientes</h1>
        <p style={{ color: W.muted, fontSize: 14 }}>{clients.length} clientes asignados</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre o @username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 280px', padding: '9px 14px', borderRadius: 8,
            background: W.card, border: `1px solid ${W.border}`,
            color: W.text, fontSize: 13, outline: 'none',
          }}
        />
        <select value={planFilter} onChange={(e) => setPlan(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, background: W.card, border: `1px solid ${W.border}`, color: W.text, fontSize: 13 }}>
          <option value="">Todos los planes</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="total">Total</option>
          <option value="agency">Agency</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: W.muted, fontSize: 13 }}>Cargando...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((client) => (
            <Link key={client.id} href={`/worker/clientes/${client.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20,
                cursor: 'pointer', transition: 'border-color 0.2s',
              }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = W.blue)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = W.border)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: W.text }}>{client.name}</div>
                    {client.ig_username && <div style={{ fontSize: 12, color: W.muted }}>@{client.ig_username}</div>}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
                    background: `${PLAN_COLOR[client.plan] ?? '#6b7280'}22`,
                    color: PLAN_COLOR[client.plan] ?? '#6b7280',
                    border: `1px solid ${PLAN_COLOR[client.plan] ?? '#6b7280'}44`,
                  }}>
                    {client.plan}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: W.muted, marginBottom: 8 }}>
                  {client.sector?.replace(/_/g, ' ') ?? 'Sin sector'}
                </div>
                {client.pending_in_queue > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                    ⏳ {client.pending_in_queue} pendiente{client.pending_in_queue > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
