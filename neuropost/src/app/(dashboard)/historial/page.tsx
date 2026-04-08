'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download, ExternalLink, FileText, BarChart3, CheckCircle2, ArrowRight } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Post = {
  id: string; image_url: string | null; edited_image_url: string | null;
  caption: string | null; hashtags: string[] | null; status: string;
  platform: string[]; format: string | null; published_at: string | null;
  created_at: string; ig_post_id: string | null;
};

type Invoice = {
  id: string; number: string | null; amount: number; currency: string;
  status: string | null; period_start: number; period_end: number;
  pdf_url: string | null; created: number;
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  published: { color: '#0F766E', bg: '#f0fdf4', label: 'Publicado' },
  approved:  { color: '#1565c0', bg: '#e3f2fd', label: 'Aprobado' },
  pending:   { color: '#e65100', bg: '#fff3e0', label: 'Pendiente' },
  rejected:  { color: '#c62828', bg: '#ffebee', label: 'Rechazado' },
  draft:     { color: '#6b7280', bg: '#f3f4f6', label: 'Borrador' },
  failed:    { color: '#c62828', bg: '#ffebee', label: 'Error' },
};

const selectStyle: React.CSSProperties = {
  padding: '8px 32px 8px 12px', border: '1px solid #d4d4d8', background: '#ffffff',
  fontFamily: f, fontSize: 13, color: '#111827', cursor: 'pointer', outline: 'none',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
};

export default function HistorialPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, approvalRate: 0 });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<'posts' | 'facturas'>('posts');
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', platform: 'all', format: 'all', range: '3m' });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(filters as Record<string, string>);
    fetch(`/api/historial?${params}`).then((r) => r.json()).then((d) => {
      if (cancelled) return;
      setPosts(d.posts ?? []); setStats(d.stats ?? { total: 0, published: 0, approvalRate: 0 }); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    if (tab === 'facturas' && invoices.length === 0) {
      fetch('/api/billing/invoices').then((r) => r.json()).then((d) => { setInvoices(d.invoices ?? []); setInvoicesLoading(false); });
    }
  }, [tab, invoices.length]);

  async function exportCSV() {
    const res = await fetch('/api/historial/export');
    if (!res.ok) { toast.error('Error al exportar'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'historial.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const approvalColor = stats.approvalRate >= 70 ? '#0F766E' : stats.approvalRate >= 40 ? '#e65100' : '#c62828';

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      {/* ── Header ── */}
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Historial
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>Analiza, filtra y revisa todo tu contenido</p>
        </div>
        <button onClick={exportCSV} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
          border: '1px solid #d4d4d8', background: '#ffffff', cursor: 'pointer',
          fontFamily: f, fontSize: 12, fontWeight: 600, color: '#6b7280', flexShrink: 0,
        }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 32, borderBottom: '1px solid #d4d4d8', marginBottom: 32 }}>
        {(['posts', 'facturas'] as const).map((t) => (
          <button key={t} onClick={() => { if (t === 'facturas' && invoices.length === 0) setInvoicesLoading(true); setTab(t); }} style={{
            background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12,
            fontFamily: fc, fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
            color: tab === t ? '#111827' : '#9ca3af',
            borderBottom: tab === t ? '2px solid #111827' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t === 'posts' ? 'Contenido' : 'Facturas'}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <>
          {/* ── KPI Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 32 }}>
            {[
              { icon: FileText, label: 'Total creados', value: String(stats.total), sub: 'Últimos 3 meses' },
              { icon: CheckCircle2, label: 'Publicados', value: String(stats.published), sub: stats.total > 0 ? `${Math.round((stats.published / stats.total) * 100)}% del total` : '—' },
              { icon: BarChart3, label: 'Tasa de aprobación', value: `${stats.approvalRate}%`, sub: stats.approvalRate >= 70 ? 'Excelente' : stats.approvalRate >= 40 ? 'Mejorable' : 'Bajo', color: approvalColor },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} style={{ background: '#ffffff', padding: '24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Icon size={14} style={{ color: '#9ca3af' }} />
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>{label}</span>
                </div>
                <p style={{ fontFamily: fc, fontWeight: 900, fontSize: '2.4rem', letterSpacing: '-0.02em', color: color ?? '#111827', lineHeight: 1 }}>{value}</p>
                <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { key: 'status', options: [{ v: 'all', l: 'Estado' }, { v: 'published', l: 'Publicados' }, { v: 'approved', l: 'Aprobados' }, { v: 'rejected', l: 'Rechazados' }, { v: 'draft', l: 'Borradores' }] },
              { key: 'platform', options: [{ v: 'all', l: 'Plataforma' }, { v: 'instagram', l: 'Instagram' }, { v: 'facebook', l: 'Facebook' }] },
              { key: 'format', options: [{ v: 'all', l: 'Formato' }, { v: 'image', l: 'Imagen' }, { v: 'reel', l: 'Reel' }, { v: 'story', l: 'Story' }] },
              { key: 'range', options: [{ v: '1m', l: 'Este mes' }, { v: '3m', l: '3 meses' }, { v: 'all', l: 'Todo' }] },
            ].map(({ key, options }) => (
              <select key={key} value={(filters as Record<string, string>)[key]} onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))} style={selectStyle}>
                {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
            {Object.values(filters).some((v) => v !== 'all' && v !== '3m') && (
              <button onClick={() => setFilters({ status: 'all', platform: 'all', format: 'all', range: '3m' })} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: f, fontSize: 12, color: '#9ca3af', textDecoration: 'underline', textUnderlineOffset: 3,
              }}>
                Reset filtros
              </button>
            )}
          </div>

          {/* ── Posts grid ── */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ background: '#ffffff', padding: 0 }}>
                  <div style={{ aspectRatio: '1', background: '#f3f4f6' }} />
                  <div style={{ padding: '12px 14px' }}><div style={{ width: '60%', height: 10, background: '#f3f4f6', borderRadius: 2 }} /></div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Sin resultados</p>
              <p style={{ fontSize: 14, color: '#9ca3af', fontFamily: f, marginBottom: 32 }}>Prueba con otros filtros o crea tu primer post</p>
              <Link href="/posts/new" style={{
                background: '#111827', color: '#ffffff', padding: '12px 28px', textDecoration: 'none',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                Crear contenido <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8' }}>
              {posts.map((post) => {
                const img = post.edited_image_url ?? post.image_url;
                const st = STATUS_STYLE[post.status] ?? STATUS_STYLE.draft;
                return (
                  <Link key={post.id} href={`/posts/${post.id}`} style={{ background: '#ffffff', textDecoration: 'none', color: 'inherit', display: 'block', transition: 'background 0.15s' }}>
                    <div style={{ aspectRatio: '1', background: '#f3f4f6', overflow: 'hidden', position: 'relative' }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#d1d5db' }}>📸</div>
                      )}
                      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 600, padding: '2px 8px', color: st.color, background: st.bg, fontFamily: f }}>{st.label}</span>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      {post.caption && (
                        <p style={{ fontFamily: f, fontSize: 12, color: '#374151', lineHeight: 1.4, margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {post.caption}
                        </p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
                          {(post.published_at ? new Date(post.published_at) : new Date(post.created_at)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                        {post.ig_post_id && (
                          <span style={{ fontFamily: f, fontSize: 10, color: '#0F766E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <ExternalLink size={10} /> IG
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Facturas ── */}
      {tab === 'facturas' && (
        <div>
          {invoicesLoading ? (
            <div style={{ border: '1px solid #d4d4d8' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ padding: '16px 24px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', background: '#ffffff' }}>
                  <div style={{ width: '40%', height: 12, background: '#f3f4f6', borderRadius: 2 }} />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Sin facturas</p>
              <p style={{ fontSize: 14, color: '#9ca3af', fontFamily: f }}>Las facturas aparecerán aquí después del primer pago</p>
            </div>
          ) : (
            <div style={{ border: '1px solid #d4d4d8' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '10px 24px', borderBottom: '1px solid #d4d4d8', background: '#f9fafb' }}>
                {['Periodo', 'Número', 'Estado', 'Importe', ''].map((h) => (
                  <span key={h} style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>{h}</span>
                ))}
              </div>
              {invoices.map((inv, i) => (
                <div key={inv.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '14px 24px',
                  borderBottom: i < invoices.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: '#ffffff', alignItems: 'center', transition: 'background 0.15s',
                }}>
                  <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {new Date(inv.period_start * 1000).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>#{inv.number ?? inv.id.slice(-8)}</span>
                  <span style={{
                    fontFamily: f, fontSize: 10, fontWeight: 600, padding: '2px 8px', alignSelf: 'center', display: 'inline-block', width: 'fit-content',
                    color: inv.status === 'paid' ? '#0F766E' : '#e65100',
                    background: inv.status === 'paid' ? '#f0fdf4' : '#fff3e0',
                  }}>
                    {inv.status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </span>
                  <span style={{ fontFamily: fc, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    {inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                  </span>
                  {inv.pdf_url ? (
                    <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280',
                      fontWeight: 600, textDecoration: 'none', fontFamily: f,
                    }}>
                      <Download size={12} /> PDF
                    </a>
                  ) : <span />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
