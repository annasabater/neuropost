'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, ExternalLink } from 'lucide-react';

type Post = {
  id: string;
  image_url: string | null;
  edited_image_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
  status: string;
  platform: string[];
  format: string | null;
  published_at: string | null;
  created_at: string;
  ig_post_id: string | null;
};

type Invoice = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  period_start: number;
  period_end: number;
  pdf_url: string | null;
  created: number;
};

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
  published: { color: '#065f46', bg: '#d1fae5', label: 'Publicado' },
  approved:  { color: '#1d4ed8', bg: '#dbeafe', label: 'Aprobado' },
  pending:   { color: '#92400e', bg: '#fef3c7', label: 'Pendiente' },
  rejected:  { color: '#991b1b', bg: '#fee2e2', label: 'Rechazado' },
  draft:     { color: '#6b7280', bg: '#f3f4f6', label: 'Borrador' },
  failed:    { color: '#991b1b', bg: '#fee2e2', label: 'Error' },
};

export default function HistorialPage() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [stats, setStats]       = useState({ total: 0, published: 0, approvalRate: 0 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab]           = useState<'posts' | 'facturas'>('posts');
  const [loading, setLoading]   = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [filters, setFilters]   = useState({ status: 'all', platform: 'all', format: 'all', range: '3m' });

  useEffect(() => {
    const params = new URLSearchParams(filters as Record<string, string>);
    setLoading(true);
    fetch(`/api/historial?${params}`).then((r) => r.json()).then((d) => {
      setPosts(d.posts ?? []);
      setStats(d.stats ?? { total: 0, published: 0, approvalRate: 0 });
      setLoading(false);
    });
  }, [filters]);

  useEffect(() => {
    if (tab === 'facturas' && invoices.length === 0) {
      setInvoicesLoading(true);
      fetch('/api/billing/invoices').then((r) => r.json()).then((d) => {
        setInvoices(d.invoices ?? []);
        setInvoicesLoading(false);
      });
    }
  }, [tab, invoices.length]);

  async function exportCSV() {
    const res = await fetch('/api/historial/export');
    if (!res.ok) { toast.error('Error al exportar'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'historial.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Historial</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Todo el contenido creado para tu negocio</p>
        </div>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        {(['posts', 'facturas'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#ff6b35' : '#6b7280',
            borderBottom: tab === t ? '2px solid #ff6b35' : '2px solid transparent',
          }}>
            {t === 'posts' ? 'Contenido' : 'Mis facturas'}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total creados', value: stats.total },
              { label: 'Publicados', value: stats.published },
              { label: 'Tasa de aprobación', value: `${stats.approvalRate}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { key: 'status', options: [{ v: 'all', l: 'Todos' }, { v: 'published', l: 'Publicados' }, { v: 'approved', l: 'Aprobados' }, { v: 'rejected', l: 'Rechazados' }, { v: 'draft', l: 'Borradores' }] },
              { key: 'platform', options: [{ v: 'all', l: 'Todas' }, { v: 'instagram', l: 'Instagram' }, { v: 'facebook', l: 'Facebook' }] },
              { key: 'format', options: [{ v: 'all', l: 'Formatos' }, { v: 'image', l: 'Imagen' }, { v: 'reel', l: 'Reel' }, { v: 'story', l: 'Story' }] },
              { key: 'range', options: [{ v: '1m', l: 'Este mes' }, { v: '3m', l: 'Últimos 3 meses' }, { v: 'all', l: 'Todo' }] },
            ].map(({ key, options }) => (
              <select key={key} value={(filters as Record<string, string>)[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>

          {loading ? <p style={{ color: '#9ca3af' }}>Cargando...</p> : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48 }}>📭</div>
              <div style={{ marginTop: 12 }}>Sin posts con estos filtros</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {posts.map((post) => {
                const img = post.edited_image_url ?? post.image_url;
                const st = STATUS_COLOR[post.status] ?? STATUS_COLOR.draft;
                return (
                  <div key={post.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
                    <div style={{ aspectRatio: '1', background: '#f3f4f6', overflow: 'hidden' }}>
                      {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📸</div>}
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {post.published_at ? new Date(post.published_at).toLocaleDateString('es-ES') : new Date(post.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      {post.caption && <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.caption}</p>}
                      {post.ig_post_id && (
                        <a href={`https://www.instagram.com/p/${post.ig_post_id}`} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ff6b35', marginTop: 8, textDecoration: 'none', fontWeight: 600 }}
                          onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={11} /> Ver en Instagram
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'facturas' && (
        <div>
          {invoicesLoading ? <p style={{ color: '#9ca3af' }}>Cargando facturas...</p> : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48 }}>🧾</div>
              <div style={{ marginTop: 12 }}>Sin facturas todavía</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              {invoices.map((inv, i) => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < invoices.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {new Date(inv.period_start * 1000).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>#{inv.number ?? inv.id.slice(-8)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ fontWeight: 700 }}>{inv.amount.toFixed(2)} {inv.currency.toUpperCase()}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: inv.status === 'paid' ? '#065f46' : '#92400e', background: inv.status === 'paid' ? '#d1fae5' : '#fef3c7' }}>
                      {inv.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </span>
                    {inv.pdf_url && (
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#ff6b35', fontWeight: 600, textDecoration: 'none' }}>
                        <Download size={14} /> PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
