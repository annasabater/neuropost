'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ExternalLink, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  bg1: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
};

type Reference = {
  id: string;
  brand_id: string;
  type: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  notes: string | null;
  sector: string | null;
  style_tags: string[] | null;
  format: string | null;
  is_saved: boolean;
  created_at: string;
};

type Recreation = {
  id: string;
  brand_id: string;
  reference_id: string | null;
  client_notes: string | null;
  style_to_adapt: string[] | null;
  status: string;
  worker_notes: string | null;
  created_at: string;
};

const FORMATS = [
  { key: 'all', label: 'Todos' },
  { key: 'image', label: 'Imagen' },
  { key: 'reel', label: 'Reel' },
  { key: 'carousel', label: 'Carrusel' },
  { key: 'story', label: 'Story' },
] as const;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendiente',  color: '#f59e0b' },
  in_progress: { label: 'En proceso', color: '#3b82f6' },
  completed:   { label: 'Completada', color: '#10b981' },
  rejected:    { label: 'Rechazada',  color: '#6b7280' },
};

export function InspiracionTab({ brandId }: { brandId: string }) {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [recreations, setRecreations] = useState<Recreation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState<(typeof FORMATS)[number]['key']>('all');
  const [view, setView] = useState<'referencias' | 'recreaciones'>('referencias');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/worker/clientes/${brandId}/inspiracion`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error');
        setRefs(data.references ?? []);
        setRecreations(data.recreations ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brandId]);

  const filteredRefs = useMemo(
    () => refs.filter((r) => formatFilter === 'all' || r.format === formatFilter),
    [refs, formatFilter],
  );

  const pendingRecreations = recreations.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;

  return (
    <div style={{ fontFamily: f, color: C.text }}>
      {/* Sub-tab switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border, border: `1px solid ${C.border}`, marginBottom: 24 }}>
        {(['referencias', 'recreaciones'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '16px 20px', background: view === v ? C.accent : C.card,
              color: view === v ? '#fff' : C.text,
              border: 'none', cursor: 'pointer', fontFamily: fc, fontSize: 13,
              fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {v === 'referencias' ? <Sparkles size={15} /> : <Wand2 size={15} />}
            {v === 'referencias' ? `Referencias (${refs.length})` : `Recreaciones (${recreations.length})`}
            {v === 'recreaciones' && pendingRecreations > 0 && view !== 'recreaciones' && (
              <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '1px 6px' }}>
                {pendingRecreations}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted, background: C.card, border: `1px solid ${C.border}` }}>
          Cargando…
        </div>
      ) : view === 'referencias' ? (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {FORMATS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFormatFilter(opt.key)}
                style={{
                  padding: '8px 16px', background: formatFilter === opt.key ? C.accent : C.card,
                  color: formatFilter === opt.key ? '#fff' : C.muted,
                  border: `1px solid ${formatFilter === opt.key ? C.accent : C.border}`,
                  fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.05em', cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filteredRefs.length === 0 ? (
            <div style={{ padding: 80, textAlign: 'center', background: C.card, border: `1px solid ${C.border}` }}>
              <Sparkles size={48} color={C.muted} style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontFamily: fc, fontSize: 18, fontWeight: 900, margin: '0 0 6px', textTransform: 'uppercase' }}>
                Sin referencias
              </h3>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                Este cliente aún no ha guardado ninguna inspiración.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {filteredRefs.map((ref) => (
                <div key={ref.id} style={{ background: C.card, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ aspectRatio: '1', background: C.bg1, position: 'relative', overflow: 'hidden' }}>
                    {ref.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={ref.thumbnail_url} alt={ref.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={32} color={C.muted} />
                      </div>
                    )}
                    {ref.format && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8, padding: '3px 7px',
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        fontSize: 10, fontWeight: 800, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {ref.format}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ref.title && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ref.title}
                      </div>
                    )}
                    {ref.notes && (
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ref.notes}
                      </div>
                    )}
                    {ref.style_tags && ref.style_tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {ref.style_tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{ fontSize: 10, padding: '2px 6px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}`, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {ref.source_url && (
                      <a href={ref.source_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.accent, textDecoration: 'none', fontWeight: 700, paddingTop: 6 }}>
                        <ExternalLink size={11} /> Ver fuente
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : recreations.length === 0 ? (
        <div style={{ padding: 80, textAlign: 'center', background: C.card, border: `1px solid ${C.border}` }}>
          <Wand2 size={48} color={C.muted} style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontFamily: fc, fontSize: 18, fontWeight: 900, margin: '0 0 6px', textTransform: 'uppercase' }}>
            Sin solicitudes de recreación
          </h3>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
            Cuando el cliente pida recrear una inspiración aparecerá aquí.
          </p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}` }}>
          {recreations.map((r, i) => {
            const st = STATUS_LABEL[r.status] ?? { label: r.status, color: C.muted };
            return (
              <div key={r.id} style={{ padding: '16px 20px', borderBottom: i < recreations.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    Recreación · {new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', color: st.color, background: `${st.color}15`, border: `1px solid ${st.color}44`, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {st.label}
                  </span>
                </div>
                {r.client_notes && (
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 6, lineHeight: 1.5 }}>
                    <strong style={{ color: C.muted, fontSize: 11, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>Cliente:</strong>
                    {r.client_notes}
                  </div>
                )}
                {r.worker_notes && (
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, paddingTop: 6, borderTop: `1px dashed ${C.border}`, marginTop: 8 }}>
                    <strong style={{ color: C.accent, fontSize: 11, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>Worker:</strong>
                    {r.worker_notes}
                  </div>
                )}
                {r.style_to_adapt && r.style_to_adapt.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {r.style_to_adapt.map((s) => (
                      <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}`, fontFamily: fc, textTransform: 'uppercase' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
