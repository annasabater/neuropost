'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProspectStatusBadge } from '@/components/admin/ProspectStatusBadge';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db' };

interface Prospect {
  id: string; username: string | null; full_name: string | null; profile_pic_url: string | null;
  sector: string | null; city: string | null; channel: string; status: string;
  followers: number; last_activity: string;
}

const STATUSES = ['', 'contacted', 'replied', 'interested', 'converted', 'not_interested'];
const CHANNELS = ['', 'instagram', 'email', 'meta_ads'];

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ProspectsPage() {
  const sp     = useSearchParams();
  const router = useRouter();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState(sp.get('q') ?? '');
  const [status,    setStatus]    = useState(sp.get('status') ?? '');
  const [channel,   setChannel]   = useState(sp.get('channel') ?? '');
  const [page,      setPage]      = useState(Number(sp.get('page') ?? 1));

  const [showAdd,    setShowAdd]    = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [adding,     setAdding]     = useState(false);

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)  params.set('q', search);
    if (status)  params.set('status', status);
    if (channel) params.set('channel', channel);
    params.set('page', String(page));

    const res  = await fetch(`/api/admin/prospects?${params}`);
    const data = await res.json() as { prospects: Prospect[]; total: number };
    setProspects(data.prospects ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [search, status, channel, page]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newUsername.trim()) return;
    setAdding(true);
    await fetch('/api/admin/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername.trim(), channel: 'instagram', status: 'contacted' }),
    });
    setAdding(false);
    setShowAdd(false);
    setNewUsername('');
    load();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: 0 }}>Prospects</h1>
          <p style={{ color: A.muted, fontSize: 13, margin: '4px 0 0' }}>{total} registros</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: A.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={15} /> Añadir
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: A.muted }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar usuario, nombre, email..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, color: A.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {[
          { value: status,  onChange: (v: string) => { setStatus(v); setPage(1); },  opts: STATUSES,  placeholder: 'Estado' },
          { value: channel, onChange: (v: string) => { setChannel(v); setPage(1); }, opts: CHANNELS, placeholder: 'Canal' },
        ].map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 8, color: f.value ? A.text : A.muted, fontSize: 13, padding: '9px 12px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">{f.placeholder}</option>
            {f.opts.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${A.border}` }}>
              {['Usuario', 'Sector / Ciudad', 'Canal', 'Estado', 'Seguidores', 'Última actividad'].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: A.muted, textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: A.muted, fontSize: 13 }}>Cargando...</td></tr>
            )}
            {!loading && prospects.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: A.muted, fontSize: 13 }}>Sin resultados.</td></tr>
            )}
            {!loading && prospects.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/captacion/prospects/${p.id}`)}
                style={{ borderBottom: `1px solid ${A.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#22201e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.profile_pic_url ? (
                      <img src={p.profile_pic_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: A.border, flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: A.text }}>@{p.username ?? '—'}</div>
                      {p.full_name && <div style={{ fontSize: 11, color: A.muted }}>{p.full_name}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: A.muted }}>{[p.sector, p.city].filter(Boolean).join(' · ') || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: A.muted, textTransform: 'capitalize' }}>{p.channel}</td>
                <td style={{ padding: '12px 16px' }}>
                  <ProspectStatusBadge status={p.status as never} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: A.muted }}>{p.followers.toLocaleString('es-ES')}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: A.muted }}>{timeStr(p.last_activity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 6, padding: '6px 10px', color: A.text, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, color: A.muted }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 6, padding: '6px 10px', color: A.text, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Add prospect modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 14, padding: 28, width: 360 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: A.text, margin: '0 0 16px' }}>Añadir prospect</h2>
            <input
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="@username de Instagram"
              style={{ width: '100%', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, color: A.text, fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: A.bg, border: `1px solid ${A.border}`, borderRadius: 8, color: A.muted, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleAdd} disabled={adding || !newUsername.trim()} style={{ flex: 1, background: A.orange, border: 'none', borderRadius: 8, color: '#fff', padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', opacity: adding || !newUsername.trim() ? 0.6 : 1 }}>
                {adding ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
