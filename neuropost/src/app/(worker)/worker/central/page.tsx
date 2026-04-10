'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Image, AlertCircle, Clock, Check } from 'lucide-react';
import Link from 'next/link';

const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
};

const f = "var(--font-barlow)";
const fc = "var(--font-barlow-condensed)";

type PostsByState = {
  preparacion: any[];
  pendiente: any[];
  planificado: any[];
  publicado: any[];
};

type DashboardData = {
  postsByState: PostsByState;
  specialRequests: any[];
  recreationRequests: any[];
  mediaGallery: any[];
};

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function PostCard({ post }: { post: any }) {
  return (
    <Link href={`/worker/clientes/${post.brand_id}`}>
      <div
        style={{
          border: `1px solid ${C.border}`,
          background: C.card,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.bg1)}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.card)}
      >
        {post.edited_image_url || post.image_url ? (
          <img
            src={post.edited_image_url || post.image_url}
            alt={post.caption || 'Post'}
            style={{ width: '100%', height: 160, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 160,
              background: C.bg1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image size={32} color={C.muted} />
          </div>
        )}
        <div style={{ padding: '12px 16px' }}>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 8px' }}>
            {post.brands?.name || 'Sin marca'}
          </p>
          <p style={{ fontSize: 12, color: C.text, margin: '0', lineClamp: 2 }}>
            {post.caption || '(sin caption)'}
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', fontStyle: 'italic' }}>
            {timeAgo(post.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function RequestCard({ req, type }: { req: any; type: 'special' | 'recreation' }) {
  const iconMap = {
    special: <AlertCircle size={20} />,
    recreation: <Image size={20} />,
  };

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        background: C.card,
        padding: '16px',
        display: 'flex',
        gap: 12,
      }}
    >
      <div style={{ color: C.accent, flexShrink: 0 }}>{iconMap[type]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            {type === 'special' ? req.title : 'Recrear referencia'}
          </p>
          <span
            style={{
              fontSize: 11,
              background: C.bg1,
              color: C.text,
              padding: '4px 8px',
              borderRadius: 0,
              fontFamily: fc,
              fontWeight: 600,
            }}
          >
            {req.status}
          </span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 8px' }}>
          {req.brands?.name || 'Sin marca'}
        </p>
        {type === 'special' && (
          <p style={{ fontSize: 12, color: C.text, margin: 0 }}>
            {req.description || '(sin descripción)'}
          </p>
        )}
        {type === 'recreation' && req.inspiration_references && (
          <p style={{ fontSize: 12, color: C.text, margin: 0 }}>
            📌 {req.inspiration_references.title}
          </p>
        )}
        <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0', fontStyle: 'italic' }}>
          {timeAgo(req.created_at)}
        </p>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Resumen', icon: '📊' },
  { id: 'posts', label: 'Posts por estado', icon: '📸' },
  { id: 'requests', label: 'Solicitudes', icon: '✉️' },
  { id: 'media', label: 'Galería de medios', icon: '🖼️' },
];

export default function WorkerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as string) || 'overview';
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worker/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>
        Cargando datos...
      </div>
    );

  if (!data)
    return (
      <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>
        No se pudieron cargar los datos
      </div>
    );

  const stats = {
    preparacion: data.postsByState.preparacion.length,
    pendiente: data.postsByState.pendiente.length,
    planificado: data.postsByState.planificado.length,
    publicado: data.postsByState.publicado.length,
    solicitudes: data.specialRequests.length,
    recreaciones: data.recreationRequests.length,
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ padding: '40px 0 32px' }}>
        <h1 style={{ fontSize: 32, fontFamily: fc, fontWeight: 900, margin: 0, color: C.text }}>
          Centro de control
        </h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '8px 0 0', fontFamily: f }}>
          Todo lo que llega desde tus clientes
        </p>
      </div>

      {/* ── Tab Navigation Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          background: C.border,
          border: `1px solid ${C.border}`,
          marginBottom: 32,
        }}
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => router.push(`/worker?tab=${id}`)}
            style={{
              background: tab === id ? C.accent2 : C.card,
              border: 'none',
              padding: '16px 12px',
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: fc,
              fontWeight: 600,
              fontSize: 12,
              color: tab === id ? '#ffffff' : C.text,
              transition: 'background 0.15s',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1px',
              background: C.border,
              border: `1px solid ${C.border}`,
              marginBottom: 32,
            }}
          >
            {[
              { label: 'En preparación', value: stats.preparacion },
              { label: 'En pendiente', value: stats.pendiente },
              { label: 'Planificado', value: stats.planificado },
              { label: 'Publicado', value: stats.publicado },
              { label: 'Solicitudes', value: stats.solicitudes },
              { label: 'Recreaciones', value: stats.recreaciones },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.card, padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontFamily: fc, fontWeight: 900, margin: '0 0 8px', color: C.accent }}>
                  {value}
                </p>
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div>
            <h2 style={{ fontSize: 16, fontFamily: fc, fontWeight: 700, margin: '0 0 16px', color: C.text }}>
              Actividad reciente
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
              {[
                ...data.postsByState.pendiente.slice(0, 2).map((p) => ({
                  type: 'post',
                  icon: '📋',
                  title: 'Post pendiente',
                  desc: p.brands?.name,
                  time: timeAgo(p.created_at),
                })),
                ...data.specialRequests.slice(0, 2).map((r) => ({
                  type: 'req',
                  icon: '✉️',
                  title: r.title,
                  desc: r.brands?.name,
                  time: timeAgo(r.created_at),
                })),
              ]
                .sort((a, b) => 0)
                .slice(0, 5)
                .map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: C.card,
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
                          {item.title}
                        </p>
                        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
                      {item.time}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── POSTS BY STATE TAB ── */}
      {tab === 'posts' && (
        <div>
          {['preparacion', 'pendiente', 'planificado', 'publicado'].map((state) => (
            <div key={state} style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontFamily: fc,
                  fontWeight: 700,
                  margin: '0 0 16px',
                  color: C.text,
                  textTransform: 'capitalize',
                }}
              >
                📋 {state === 'preparacion' ? 'En preparación' : state === 'pendiente' ? 'En pendiente' : state === 'planificado' ? 'Planificado' : 'Publicado'}{' '}
                ({(data.postsByState as any)[state].length})
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '1px',
                  background: C.border,
                }}
              >
                {(data.postsByState as any)[state].map((post: any) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Special Requests */}
          <div>
            <h2 style={{ fontSize: 16, fontFamily: fc, fontWeight: 700, margin: '0 0 16px', color: C.text }}>
              ✉️ Solicitudes especiales ({data.specialRequests.length})
            </h2>
            {data.specialRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {data.specialRequests.slice(0, 10).map((req) => (
                  <RequestCard key={req.id} req={req} type="special" />
                ))}
              </div>
            ) : (
              <p style={{ color: C.muted, fontSize: 13 }}>No hay solicitudes</p>
            )}
          </div>

          {/* Recreation Requests */}
          <div>
            <h2 style={{ fontSize: 16, fontFamily: fc, fontWeight: 700, margin: '0 0 16px', color: C.text }}>
              🎨 Solicitudes de recreación ({data.recreationRequests.length})
            </h2>
            {data.recreationRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {data.recreationRequests.slice(0, 10).map((req) => (
                  <RequestCard key={req.id} req={req} type="recreation" />
                ))}
              </div>
            ) : (
              <p style={{ color: C.muted, fontSize: 13 }}>No hay solicitudes</p>
            )}
          </div>
        </div>
      )}

      {/* ── MEDIA GALLERY TAB ── */}
      {tab === 'media' && (
        <div>
          <h2 style={{ fontSize: 16, fontFamily: fc, fontWeight: 700, margin: '0 0 16px', color: C.text }}>
            Galería de medios ({data.mediaGallery.length})
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1px',
              background: C.border,
            }}
          >
            {data.mediaGallery.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
