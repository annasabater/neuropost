'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Image, AlertCircle, X, Search } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

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

const STATE_LABELS = {
  preparacion: '📋 En preparación',
  pendiente: '⏳ En pendiente',
  planificado: '📅 Planificado',
  publicado: '📤 Publicado',
};

export default function WorkerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as string) || 'overview';
  const [data, setData] = useState<DashboardData | null>(null);
  const [filteredData, setFilteredData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/worker/dashboard');
        const dashData = await res.json();
        setData(dashData);
        setFilteredData(dashData);
      } catch (err) {
        toast.error('Error cargando datos');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const supabase = createBrowserClient();
    supabaseRef.current = supabase;

    // Subscribe to posts changes
    const postsChannel = supabase
      .channel('worker-posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        toast.success('📸 Nuevo post disponible');
        // Reload data
        fetch('/api/worker/dashboard')
          .then((r) => r.json())
          .then((newData) => {
            setData(newData);
            applyFilters(newData, search, selectedBrand, selectedState);
          });
      })
      .subscribe();

    // Subscribe to special_requests changes
    const reqChannel = supabase
      .channel('worker-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_requests' }, () => {
        toast.success('✉️ Nueva solicitud');
        fetch('/api/worker/dashboard')
          .then((r) => r.json())
          .then((newData) => {
            setData(newData);
            applyFilters(newData, search, selectedBrand, selectedState);
          });
      })
      .subscribe();

    // Subscribe to recreation_requests changes
    const recChannel = supabase
      .channel('worker-recreation-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recreation_requests' }, () => {
        toast.success('🎨 Nueva solicitud de recreación');
        fetch('/api/worker/dashboard')
          .then((r) => r.json())
          .then((newData) => {
            setData(newData);
            applyFilters(newData, search, selectedBrand, selectedState);
          });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(postsChannel);
      void supabase.removeChannel(reqChannel);
      void supabase.removeChannel(recChannel);
    };
  }, [search, selectedBrand, selectedState]);

  // Apply filters
  function applyFilters(baseData: DashboardData, searchTerm: string, brandId: string, state: string) {
    if (!baseData) return;

    let result = { ...baseData };

    // Filter posts by state
    if (state !== 'all') {
      const states = Object.keys(baseData.postsByState) as (keyof PostsByState)[];
      states.forEach((s) => {
        result.postsByState[s] = result.postsByState[s].filter(
          (p) => state === 'all' || s === state
        );
      });
    }

    // Filter by brand
    if (brandId !== 'all') {
      Object.keys(result.postsByState).forEach((key) => {
        result.postsByState[key as keyof PostsByState] = result.postsByState[key as keyof PostsByState].filter((p) => p.brand_id === brandId);
      });
      result.specialRequests = result.specialRequests.filter((r) => r.brand_id === brandId);
      result.recreationRequests = result.recreationRequests.filter((r) => r.brand_id === brandId);
      result.mediaGallery = result.mediaGallery.filter((m) => m.brand_id === brandId);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      Object.keys(result.postsByState).forEach((key) => {
        result.postsByState[key as keyof PostsByState] = result.postsByState[key as keyof PostsByState].filter(
          (p) =>
            (p.caption?.toLowerCase().includes(term) || false) ||
            (p.brands?.name?.toLowerCase().includes(term) || false)
        );
      });
      result.specialRequests = result.specialRequests.filter(
        (r) =>
          r.title?.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term) ||
          r.brands?.name?.toLowerCase().includes(term)
      );
      result.recreationRequests = result.recreationRequests.filter(
        (r) =>
          r.client_notes?.toLowerCase().includes(term) ||
          r.brands?.name?.toLowerCase().includes(term)
      );
      result.mediaGallery = result.mediaGallery.filter(
        (m) =>
          (m.caption?.toLowerCase().includes(term) || false) ||
          (m.brands?.name?.toLowerCase().includes(term) || false)
      );
    }

    setFilteredData(result);
  }

  // Handle search change
  const handleSearch = (value: string) => {
    setSearch(value);
    if (data) applyFilters(data, value, selectedBrand, selectedState);
  };

  // Handle brand filter
  const handleBrandFilter = (brandId: string) => {
    setSelectedBrand(brandId);
    if (data) applyFilters(data, search, brandId, selectedState);
  };

  // Handle state filter
  const handleStateFilter = (state: string) => {
    setSelectedState(state);
    if (data) applyFilters(data, search, selectedBrand, state);
  };

  if (loading)
    return (
      <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>
        Cargando datos...
      </div>
    );

  if (!data || !filteredData)
    return (
      <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>
        No se pudieron cargar los datos
      </div>
    );

  // Get unique brands for filter
  const allBrands = new Map<string, string>();
  [
    ...data.postsByState.preparacion,
    ...data.postsByState.pendiente,
    ...data.postsByState.planificado,
    ...data.postsByState.publicado,
    ...data.specialRequests,
    ...data.recreationRequests,
  ].forEach((item) => {
    if (item.brands?.id && item.brands?.name) {
      allBrands.set(item.brands.id, item.brands.name);
    }
  });

  const stats = {
    preparacion: filteredData.postsByState.preparacion.length,
    pendiente: filteredData.postsByState.pendiente.length,
    planificado: filteredData.postsByState.planificado.length,
    publicado: filteredData.postsByState.publicado.length,
    solicitudes: filteredData.specialRequests.length,
    recreaciones: filteredData.recreationRequests.length,
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ padding: '40px 0 32px' }}>
        <h1 style={{ fontSize: 32, fontFamily: fc, fontWeight: 900, margin: 0, color: C.text }}>
          Centro de control
        </h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '8px 0 0', fontFamily: f }}>
          Todo lo que llega desde tus clientes en tiempo real
        </p>
      </div>

      {/* ── Search & Filters Bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          gap: 1,
          background: C.border,
          border: `1px solid ${C.border}`,
          marginBottom: 32,
        }}
      >
        {/* Search */}
        <div style={{ background: C.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} color={C.muted} />
          <input
            type="text"
            placeholder="Buscar posts, solicitudes..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontFamily: f,
              fontSize: 13,
              outline: 'none',
              color: C.text,
            }}
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: C.muted,
                padding: 0,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Brand Filter */}
        <select
          value={selectedBrand}
          onChange={(e) => handleBrandFilter(e.target.value)}
          style={{
            background: C.card,
            border: 'none',
            padding: '12px 16px',
            fontFamily: f,
            fontSize: 13,
            color: C.text,
            cursor: 'pointer',
            borderLeft: `1px solid ${C.border}`,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          <option value="all">Todas las marcas</option>
          {Array.from(allBrands.entries()).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {/* State Filter (only show in posts/media tabs) */}
        {(tab === 'posts' || tab === 'media') && (
          <select
            value={selectedState}
            onChange={(e) => handleStateFilter(e.target.value)}
            style={{
              background: C.card,
              border: 'none',
              padding: '12px 16px',
              fontFamily: f,
              fontSize: 13,
              color: C.text,
              cursor: 'pointer',
              borderLeft: `1px solid ${C.border}`,
              borderRight: `1px solid ${C.border}`,
            }}
          >
            <option value="all">Todos los estados</option>
            <option value="preparacion">📋 En preparación</option>
            <option value="pendiente">⏳ En pendiente</option>
            <option value="planificado">📅 Planificado</option>
            <option value="publicado">📤 Publicado</option>
          </select>
        )}

        {/* Clear Filters */}
        {(search || selectedBrand !== 'all' || selectedState !== 'all') && (
          <button
            onClick={() => {
              setSearch('');
              setSelectedBrand('all');
              setSelectedState('all');
              if (data) applyFilters(data, '', 'all', 'all');
            }}
            style={{
              background: C.bg1,
              border: `1px solid ${C.border}`,
              borderLeft: `1px solid ${C.border}`,
              padding: '12px 16px',
              cursor: 'pointer',
              fontFamily: f,
              fontSize: 12,
              color: C.text,
              fontWeight: 600,
            }}
          >
            Limpiar filtros
          </button>
        )}
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
            onClick={() => router.push(`/worker/central?tab=${id}`)}
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
                ...filteredData.postsByState.pendiente.slice(0, 2).map((p) => ({
                  type: 'post',
                  icon: '📋',
                  title: 'Post pendiente',
                  desc: p.brands?.name,
                  time: timeAgo(p.created_at),
                })),
                ...filteredData.specialRequests.slice(0, 2).map((r) => ({
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
          {['preparacion', 'pendiente', 'planificado', 'publicado'].map((state) => {
            const posts = (filteredData.postsByState as any)[state];
            return (
              <div key={state} style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontFamily: fc,
                    fontWeight: 700,
                    margin: '0 0 16px',
                    color: C.text,
                  }}
                >
                  {(STATE_LABELS as any)[state]} ({posts.length})
                </h2>
                {posts.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: '1px',
                      background: C.border,
                    }}
                  >
                    {posts.map((post: any) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <p style={{ color: C.muted, fontSize: 13 }}>No hay posts en este estado</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Special Requests */}
          <div>
            <h2 style={{ fontSize: 16, fontFamily: fc, fontWeight: 700, margin: '0 0 16px', color: C.text }}>
              ✉️ Solicitudes especiales ({filteredData.specialRequests.length})
            </h2>
            {filteredData.specialRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {filteredData.specialRequests.slice(0, 20).map((req) => (
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
              🎨 Solicitudes de recreación ({filteredData.recreationRequests.length})
            </h2>
            {filteredData.recreationRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {filteredData.recreationRequests.slice(0, 20).map((req) => (
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
            Galería de medios ({filteredData.mediaGallery.length})
          </h2>
          {filteredData.mediaGallery.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '1px',
                background: C.border,
              }}
            >
              {filteredData.mediaGallery.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p style={{ color: C.muted, fontSize: 13 }}>No hay medios disponibles</p>
          )}
        </div>
      )}
    </div>
  );
}
