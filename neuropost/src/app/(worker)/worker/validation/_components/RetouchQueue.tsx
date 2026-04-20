'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                         from 'next/navigation';
import { Clock }                             from 'lucide-react';

const C = {
  card: '#ffffff', border: '#E5E7EB', text: '#111111',
  muted: '#6B7280', accent: '#0F766E', amber: '#F59E0B',
};

interface RetouchItem {
  id:              string;
  brand_id:        string;
  brand_name:      string;
  post_id:         string;
  post_caption:    string;
  post_image_url:  string | null;
  week_start:      string;
  retouch_type:    'copy' | 'schedule' | 'freeform';
  original_value:  Record<string, unknown> | null;
  requested_value: Record<string, unknown> | null;
  client_comment:  string | null;
  created_at:      string;
}

const TYPE_LABEL: Record<string, string> = {
  copy:     'Cambio de texto',
  schedule: 'Cambio de hora',
  freeform: 'Retoque libre',
};

export function RetouchQueue() {
  const router = useRouter();
  const [items,   setItems]   = useState<RetouchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/worker/retouch-requests/pending');
    const data = await res.json() as { requests?: RetouchItem[] };
    setItems(data.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 32, color: C.muted, fontSize: 14 }}>Cargando retouches...</div>;

  if (items.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>
        No hay retouches pendientes.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: `1px solid ${C.border}` }}>
      {items.map((item) => (
        <div key={item.id} style={{
          background: C.card, padding: '14px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          borderBottom: `1px solid ${C.border}`,
        }}>
          {/* Thumbnail */}
          {item.post_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.post_image_url} alt=""
              style={{ width: 56, height: 56, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }}
            />
          ) : (
            <div style={{ width: 56, height: 56, background: '#f5f5f5', flexShrink: 0, border: `1px solid ${C.border}` }} />
          )}

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{item.brand_name}</span>
              <span style={typePill}>{TYPE_LABEL[item.retouch_type] ?? item.retouch_type}</span>
            </div>

            {/* Show diff */}
            {item.retouch_type === 'copy' && (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                <span style={{ color: '#ef4444' }}>–</span>{' '}
                {truncate(String(item.original_value?.caption  ?? item.post_caption), 60)}
                {' → '}
                <span style={{ color: C.accent }}>+</span>{' '}
                {truncate(String(item.requested_value?.new_copy ?? '…'), 60)}
              </div>
            )}
            {item.retouch_type === 'schedule' && (
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                {formatDt(String(item.original_value?.scheduled_at ?? ''))}
                {' → '}
                {formatDt(String(item.requested_value?.new_scheduled_at ?? ''))}
              </div>
            )}
            {item.retouch_type === 'freeform' && item.client_comment && (
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 4px', fontStyle: 'italic' }}>
                "{truncate(item.client_comment, 80)}"
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Clock size={11} style={{ color: C.muted }} />
              <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(item.created_at)}</span>
              <span style={{ fontSize: 11, color: C.muted }}>·</span>
              <span style={{ fontSize: 11, color: C.muted }}>Semana {formatWeek(item.week_start)}</span>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={() => router.push(`/worker/retouch-requests/${item.id}`)}
            style={openBtn}
          >
            Abrir
          </button>
        </div>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function formatDt(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

function formatWeek(w: string): string {
  if (!w) return '—';
  try {
    const d = new Date(w + 'T00:00:00Z');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch { return w; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'hace menos de 1h';
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const typePill: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', background: '#fef3c7', color: C.amber,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
};
const openBtn: React.CSSProperties = {
  padding: '7px 14px', background: C.accent, color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  fontFamily: 'inherit', flexShrink: 0, alignSelf: 'center',
};
