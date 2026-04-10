'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Edit2, RefreshCw, SkipForward, ChevronLeft, ChevronRight, Radio, Pause, Play, AlertCircle, Info, AlertTriangle, BarChart, Clipboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
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
  red: '#0F766E',
  orange: '#0D9488',
  green: '#0F766E',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS & UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function waitingColor(dateStr: string) {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (h < 1) return C.green;
  if (h < 3) return C.orange;
  return C.red;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAT CARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '20px 24px', fontFamily: f }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? C.accent2, fontFamily: fc }}>{value}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1: OVERVIEW (Dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Worker = { id: string; full_name: string };
type ContentQueue = { id: string; status: string; priority: string; created_at: string; posts?: { image_url?: string }; brands?: { name?: string } };

function OverviewTab() {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [queue, setQueue] = useState<ContentQueue[]>([]);
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0' });
  const [activity, setActivity] = useState<{ id: string; action: string; details: Record<string, unknown> | null; created_at: string; brands?: { name: string } }[]>([]);

  useEffect(() => {
    fetch('/api/worker/me').then((r) => r.json()).then((d) => setWorker(d.worker));
    fetch('/api/worker/cola?status=pending_worker').then((r) => r.json()).then((d) => setQueue(d.queue ?? []));
    fetch('/api/worker/metricas?mine=1').then((r) => r.json()).then((d) => setMetrics(d));
    fetch('/api/worker/actividad?mine=1').then((r) => r.json()).then((d) => setActivity((d.events ?? []).slice(0, 10)));
  }, []);

  const urgent = queue.filter((q) => q.priority === 'urgent');
  const longWait = queue.filter((q) => (Date.now() - new Date(q.created_at).getTime()) > 2 * 3600000);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, background: C.bg }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4, fontFamily: fc }}>
          Hola, {worker?.full_name?.split(' ')[0] ?? 'trabajador'} 👋
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>
          Tienes <strong style={{ color: queue.length > 0 ? C.red : C.green }}>{queue.length} posts</strong> pendientes de validar.
        </p>
      </div>

      {/* Alert */}
      {longWait.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`,
          borderRadius: 0, padding: '14px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: f,
        }}>
          <span style={{ color: C.red, fontSize: 14 }}>
            ⚠️ {longWait.length} post{longWait.length > 1 ? 's llevan' : ' lleva'} más de 2 horas sin revisar
          </span>
          <Link href="/worker?tab=cola" style={{ color: C.red, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Ver ahora →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Pendientes de validar" value={queue.length} color={C.red} />
        <StatCard label="Validados este mes" value={metrics.totalValidated} />
        <StatCard label="Tasa aprobación clientes" value={`${metrics.approvalRate}%`} color={C.green} />
        <StatCard label="Tiempo medio respuesta" value={`${metrics.avgResponseTimeH}h`} color={C.orange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Queue preview */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Cola de hoy</h2>
            <Link href="/worker?tab=cola" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: f }}>Ver todo →</Link>
          </div>
          {queue.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0', fontFamily: f }}>¡Sin pendientes! 🎉</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...queue].sort((a, b) => {
                if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }).slice(0, 5).map((item) => (
                <Link key={item.id} href={`/worker/cola?id=${item.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', background: C.bg1, borderRadius: 0,
                  textDecoration: 'none', border: `1px solid ${C.border}`, fontFamily: f,
                  transition: 'background 0.15s',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 0, background: C.border, flexShrink: 0, overflow: 'hidden' }}>
                    {item.posts?.image_url && (
                      <img src={item.posts.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.brands?.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 11, color: waitingColor(item.created_at) }}>
                      ⏱ {timeAgo(item.created_at)}
                      {item.priority === 'urgent' && <span style={{ marginLeft: 6, background: C.red, color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 0, fontWeight: 700 }}> URGENTE</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Actividad reciente</h2>
            <Link href="/worker?tab=agentes" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: f }}>Ver todo →</Link>
          </div>
          {activity.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0', fontFamily: f }}>Sin actividad reciente</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map((event) => (
                <div key={event.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: f }}>
                  <div style={{ fontSize: 16 }}>
                    {event.action === 'post_uploaded' ? '📸'
                     : event.action === 'post_approved' ? '✅'
                     : event.action === 'post_rejected' ? '❌'
                     : event.action === 'instagram_connected' ? '🔑'
                     : event.action === 'plan_changed' ? '💳'
                     : '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                      <strong>{event.brands?.name ?? 'Cliente'}</strong>{' '}
                      {event.action.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{timeAgo(event.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2: COLA (Queue)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type QueueItem = ContentQueue & {
  posts?: { image_url: string | null; edited_image_url: string | null; caption: string | null; hashtags: string[]; format: string; platform: string[]; quality_score: number | null; client_notes_for_worker: string | null };
  brands?: { id: string; name: string; sector: string };
};

type RecreationRequest = {
  id: string;
  brand_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  client_notes: string | null;
  worker_notes: string | null;
  created_at: string;
  inspiration_references: any | null;
  brands: any | null;
};

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'pending_worker', label: 'Pendientes' },
  { value: 'worker_rejected', label: 'Rechazados' },
  { value: 'client_rejected', label: 'Rechazados por cliente' },
];

function ColaTab() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [statusFilter, setStatus] = useState('pending_worker');
  const [workerNotes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recreations, setRecreations] = useState<RecreationRequest[]>([]);

  useEffect(() => {
    fetch('/api/worker/recreaciones')
      .then((r) => r.json())
      .then((d) => setRecreations(d.recreations ?? []))
      .catch(() => null);
  }, []);

  const fetchQueue = useCallback(async () => {
    const url = statusFilter ? `/api/worker/cola?status=${statusFilter}` : '/api/worker/cola';
    const res = await fetch(url);
    const json = await res.json();
    const q = json.queue ?? [];
    setItems(q);
    if (initialId && !selected) {
      const found = q.find((i: QueueItem) => i.id === initialId);
      if (found) { setSelected(found); setNotes(''); }
    }
  }, [statusFilter, initialId, selected]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function handleAction(action: 'approve' | 'reject' | 'urgent') {
    if (!selected) return;
    setLoading(true);
    try {
      let newStatus = '';
      if (action === 'approve') newStatus = 'sent_to_client';
      if (action === 'reject') newStatus = 'worker_rejected';

      if (action === 'urgent') {
        await fetch('/api/worker/cola', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queueId: selected.id, status: selected.status, priority: 'urgent' }) });
        toast.success('Marcado como urgente');
        setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, priority: 'urgent' } : i));
        setSelected((s) => s ? { ...s, priority: 'urgent' } : s);
        setLoading(false);
        return;
      }

      await fetch('/api/worker/cola', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: selected.id, status: newStatus, worker_notes: workerNotes }),
      });
      toast.success(action === 'approve' ? '✅ Enviado al cliente' : '❌ Rechazado');
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setSelected(null);
      setNotes('');
      setShowReject(false);
    } catch {
      toast.error('Error al procesar');
    } finally {
      setLoading(false);
    }
  }

  const score = selected?.posts?.quality_score ?? null;
  const scoreColor = score == null ? C.muted : score >= 80 ? C.green : score >= 60 ? C.orange : C.red;
  const scoreLabel = score == null ? '—' : score >= 80 ? 'Muy bueno' : score >= 60 ? 'Aceptable' : 'Mejorable';

  const pendingRecs = recreations.filter((r) => r.status === 'pending' || r.status === 'in_progress');
  const statusBadgeColor = (s: RecreationRequest['status']) =>
    s === 'pending' ? C.orange : s === 'in_progress' ? C.accent2 : s === 'completed' ? C.green : C.red;
  const statusLabel = (s: RecreationRequest['status']) =>
    s === 'pending' ? 'Pendiente' : s === 'in_progress' ? 'En progreso' : s === 'completed' ? 'Completado' : 'Rechazado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ width: 320, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filters */}
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 12 }}>Cola de validación</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} onClick={() => setStatus(f.value)} style={{
                  padding: '4px 10px', borderRadius: 0, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: statusFilter === f.value ? C.accent2 : 'transparent',
                  color: statusFilter === f.value ? '#fff' : C.muted,
                  border: `1px solid ${statusFilter === f.value ? C.accent2 : C.border}`,
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {items.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Sin elementos en esta cola</p>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => { setSelected(item); setNotes(''); }} style={{
                  width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: 10, borderRadius: 0, marginBottom: 6,
                  background: selected?.id === item.id ? 'rgba(59,130,246,0.12)' : C.card,
                  border: `1px solid ${selected?.id === item.id ? C.accent2 : C.border}`,
                  cursor: 'pointer',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 0, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                    {item.posts?.image_url && <img src={item.posts.edited_image_url ?? item.posts.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.brands?.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>✏️ Pendiente de revisar</div>
                    <div style={{ fontSize: 10, color: waitingColor(item.created_at), marginTop: 2 }}>
                      ⏱ {timeAgo(item.created_at)}
                      {item.priority === 'urgent' && <span style={{ marginLeft: 4, background: C.red, color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 0 }}>URGENTE</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: C.muted, fontSize: 14 }}>Selecciona un elemento de la lista</p>
            </div>
          ) : (
            <div style={{ maxWidth: 700 }}>
              {/* Header */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                      {selected.brands?.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                      Contenido pendiente de validación
                      {' · '}{timeAgo(selected.created_at)}
                      {' · '}<span style={{ textTransform: 'capitalize', color: selected.priority === 'urgent' ? C.red : C.muted }}>{selected.priority}</span>
                    </div>
                    {selected.posts?.client_notes_for_worker && (
                      <div style={{ marginTop: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 0, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: C.accent2, fontWeight: 700, marginBottom: 4 }}>NOTA DEL CLIENTE</div>
                        <div style={{ fontSize: 13, color: C.text, fontStyle: 'italic' }}>"{selected.posts.client_notes_for_worker}"</div>
                      </div>
                    )}
                  </div>
                  {selected.priority !== 'urgent' && (
                    <button onClick={() => handleAction('urgent')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 0, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, cursor: 'pointer' }}>
                      🚩 Urgente
                    </button>
                  )}
                </div>
              </div>

              {/* Images */}
              {selected.posts?.image_url && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.muted }}>IMAGEN</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Original</div>
                      <img src={selected.posts.image_url} alt="original" style={{ width: '100%', borderRadius: 0, objectFit: 'cover', maxHeight: 280 }} />
                    </div>
                    {selected.posts.edited_image_url && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Editada</div>
                        <img src={selected.posts.edited_image_url} alt="edited" style={{ width: '100%', borderRadius: 0, objectFit: 'cover', maxHeight: 280 }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Caption */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted }}>CAPTION Y HASHTAGS</h3>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '12px 14px', background: C.bg1, borderRadius: 0, border: `1px solid ${C.border}` }}>
                  {selected.posts?.caption ?? '—'}
                </div>
                {selected.posts?.hashtags?.length ? (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.posts.hashtags.map((h) => (
                      <span key={h} style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(59,130,246,0.1)', color: C.accent2, borderRadius: 0 }}>#{h}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Quality score */}
              {score !== null && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted }}>SCORE DE CALIDAD</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, background: C.border, borderRadius: 0, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, background: scoreColor, height: '100%', borderRadius: 0, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>{score}/100</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{scoreLabel}</div>
                  </div>
                </div>
              )}

              {/* Worker notes */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.muted }}>NOTA PARA EL CLIENTE (opcional)</h3>
                <textarea
                  value={workerNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="El cliente verá esta nota junto al resultado..."
                  rows={3}
                  style={{
                    width: '100%', background: C.bg1, border: `1px solid ${C.border}`,
                    borderRadius: 0, padding: '10px 12px', color: C.text, fontSize: 13,
                    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={loading}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 0, fontSize: 14, fontWeight: 700,
                    background: C.green, color: '#fff', border: 'none', cursor: 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  ✅ Aprobar — Enviar al cliente
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 0, fontSize: 14, fontWeight: 700,
                    background: 'rgba(239,68,68,0.1)', color: C.red,
                    border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                  }}
                >
                  ❌ Rechazar
                </button>
              </div>

              {/* Reject modal */}
              {showReject && (
                <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 0, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 12 }}>Motivo del rechazo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {['Calidad de imagen insuficiente', 'No encaja con el estilo de la marca', 'Pedir al cliente nueva foto', 'Otro motivo'].map((reason) => (
                      <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
                        <input type="radio" name="reject" value={reason} checked={rejectReason === reason} onChange={() => setRejectReason(reason)} />
                        {reason}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setNotes(rejectReason ? `Rechazado: ${rejectReason}` : workerNotes); handleAction('reject'); }} disabled={loading || !rejectReason} style={{ flex: 1, padding: '10px', borderRadius: 0, background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: rejectReason ? 1 : 0.5 }}>
                      Confirmar rechazo
                    </button>
                    <button onClick={() => setShowReject(false)} style={{ padding: '10px 16px', borderRadius: 0, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Solicitudes de recreación */}
      {pendingRecs.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '24px 32px', background: C.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>Solicitudes de recreación</h2>
            <span style={{ background: C.accent2, color: '#fff', borderRadius: 0, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
              {pendingRecs.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingRecs.map((rec) => (
              <div
                key={rec.id}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 0, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                  {(rec.inspiration_references as any)?.thumbnail_url
                    ? <img src={(rec.inspiration_references as any).thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼</div>
                  }
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{(rec.brands as any)?.name ?? 'Cliente'}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 0,
                      color: statusBadgeColor(rec.status),
                      background: `${statusBadgeColor(rec.status)}18`,
                      border: `1px solid ${statusBadgeColor(rec.status)}40`,
                    }}>
                      {statusLabel(rec.status)}
                    </span>
                  </div>
                  {(rec.inspiration_references as any)?.title && <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>Referencia: {(rec.inspiration_references as any).title}</div>}
                  {rec.client_notes && (
                    <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic' }}>"{rec.client_notes}"</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  {(rec.inspiration_references as any)?.source_url && (
                    <a
                      href={(rec.inspiration_references as any).source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 0, color: C.muted, fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
                    >
                      Ver referencia ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 3: VALIDACIÓN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Proposal {
  id: string;
  brand_id: string;
  tema: string;
  concepto: string;
  categoria: string;
  objetivo: string;
  caption_ig: string | null;
  caption_fb: string | null;
  hashtags: { branded?: string[]; nicho?: string[]; broad?: string[] } | null;
  image_url: string | null;
  quality_score: number | null;
  qc_feedback: Record<string, unknown> | null;
  dia_publicacion: string | null;
  hora_publicacion: string | null;
  status: string;
  retry_count: number;
  brands?: { name: string };
}

function ValidacionTab() {
  const [items, setItems] = useState<Proposal[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('proposals')
      .select('*, brands(name)')
      .in('status', ['pending_qc', 'qc_rejected_image', 'qc_rejected_caption', 'failed'])
      .order('created_at', { ascending: true })
      .limit(20);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = items[idx];

  const action = useCallback(async (act: 'approve' | 'reject' | 'regen-image' | 'regen-copy' | 'skip') => {
    if (!current) return;
    if (act === 'skip') { setIdx((i) => Math.min(i + 1, items.length - 1)); return; }

    setActing(true);
    const sb = createBrowserClient();
    const updates: Record<string, unknown> = {};

    if (act === 'approve') {
      // Create the post via the worker API so plan limits (posts/week,
      // carousel size, auto-publish) are enforced server-side.
      const scheduled_at = current.dia_publicacion
        ? `${current.dia_publicacion}T${current.hora_publicacion ?? '10:00'}:00`
        : null;
      const res = await fetch('/api/worker/posts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id:      current.brand_id,
          caption:       current.caption_ig,
          hashtags: [
            ...(current.hashtags?.branded ?? []),
            ...(current.hashtags?.nicho ?? []),
            ...(current.hashtags?.broad ?? []),
          ],
          image_url:     current.image_url,
          format:        'image',
          platform:      ['instagram', 'facebook'],
          status:        scheduled_at ? 'scheduled' : 'pending',
          quality_score: current.quality_score,
          scheduled_at,
        }),
      });
      const json = await res.json() as { post?: { id: string }; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo aprobar el post');
        setActing(false);
        return;
      }

      updates.status = 'converted_to_post';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (json.post?.id) (updates as any).post_id = json.post.id;
      toast.success('Aprobado y enviado al cliente');
    } else if (act === 'reject') {
      updates.status = 'rejected';
      toast.success('Rechazado');
    } else if (act === 'regen-image') {
      updates.status = 'pending_visual';
      updates.retry_count = (current.retry_count ?? 0) + 1;
      toast.success('Regenerando imagen...');
    } else if (act === 'regen-copy') {
      updates.status = 'pending_copy';
      updates.retry_count = (current.retry_count ?? 0) + 1;
      toast.success('Regenerando caption...');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('proposals').update(updates).eq('id', current.id);
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (idx >= items.length - 1) setIdx(Math.max(0, items.length - 2));
    setActing(false);
  }, [current, idx, items]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingCaption) return;
      if (e.key === 'a' || e.key === 'A') action('approve');
      if (e.key === 'r' || e.key === 'R') action('reject');
      if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') action('skip');
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [action, editingCaption]);

  async function saveCaption() {
    if (!current) return;
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('proposals').update({ caption_ig: captionDraft }).eq('id', current.id);
    setItems((prev) => prev.map((p, i) => i === idx ? { ...p, caption_ig: captionDraft } : p));
    setEditingCaption(false);
    toast.success('Caption actualizado');
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando cola de validación...</div>;
  if (items.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <Check size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>Cola vacía</h2>
      <p style={{ color: C.muted, fontSize: 13 }}>No hay contenido pendiente de validación.</p>
    </div>
  );

  if (!current) return null;

  return (
    <div style={{ padding: 28, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Validación de contenido</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: '2px 0 0' }}>
            {idx + 1} de {items.length} — {current.brands?.name ?? 'Sin marca'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={navBtn}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1} style={navBtn}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr' }}>
          {/* Image */}
          <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380 }}>
            {current.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: C.muted, fontSize: 12 }}>Sin imagen</span>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Tema</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>{current.tema}</h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span style={pill}>{current.categoria}</span>
                <span style={pill}>{current.objetivo}</span>
                {current.quality_score && (
                  <span style={{ ...pill, background: '#10b98122', color: '#10b981' }}>
                    QC {current.quality_score}/10
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Caption Instagram</span>
              {editingCaption ? (
                <>
                  <textarea
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    rows={6}
                    style={{
                      width: '100%', padding: 10, marginTop: 4,
                      background: C.bg1, border: `1px solid ${C.border}`, color: C.text,
                      fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={saveCaption} style={{ ...primaryBtn, fontSize: 11, padding: '6px 14px' }}>Guardar</button>
                    <button onClick={() => setEditingCaption(false)} style={{ ...secondaryBtn, fontSize: 11, padding: '6px 14px' }}>Cancelar</button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0', whiteSpace: 'pre-wrap', color: C.text }}>
                  {current.caption_ig ?? <span style={{ color: C.muted, fontStyle: 'italic' }}>Sin caption</span>}
                </p>
              )}
            </div>

            {current.hashtags && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Hashtags</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {[...(current.hashtags.branded ?? []), ...(current.hashtags.nicho ?? []), ...(current.hashtags.broad ?? [])].map((h) => (
                    <span key={h} style={{ fontSize: 10, color: C.accent2, background: '#3b82f622', padding: '2px 6px', borderRadius: 0 }}>
                      #{h.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 1, background: C.border, borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => action('approve')} disabled={acting} style={actBtn('#10b981')}>
            <Check size={14} /> Aprobar (A)
          </button>
          <button onClick={() => { setCaptionDraft(current.caption_ig ?? ''); setEditingCaption(true); }} disabled={acting} style={actBtn(C.accent2)}>
            <Edit2 size={13} /> Editar caption (E)
          </button>
          <button onClick={() => action('regen-image')} disabled={acting} style={actBtn('#f59e0b')}>
            <RefreshCw size={13} /> Regenerar imagen
          </button>
          <button onClick={() => action('regen-copy')} disabled={acting} style={actBtn('#a855f7')}>
            <RefreshCw size={13} /> Regenerar copy
          </button>
          <button onClick={() => action('reject')} disabled={acting} style={actBtn('#ef4444')}>
            <X size={14} /> Rechazar (R)
          </button>
          <button onClick={() => action('skip')} disabled={acting} style={actBtn(C.muted)}>
            <SkipForward size={13} /> Saltar (N)
          </button>
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: 'center' }}>
        Atajos: A = aprobar · R = rechazar · E = editar · N = siguiente · ← → navegar
      </p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 4: AGENTES (Feed)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FeedEvent {
  id: string;
  agent: string;
  brand_id: string | null;
  action_type: string;
  title: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'success';
  brand_name: string | null;
  thumbnail_url: string | null;
  requires_attention: boolean;
  created_at: string;
}

const SEVERITY_COLORS = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

const SEVERITY_ICONS: Record<string, typeof Info> = {
  info: Info,
  success: AlertCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

function AgentesTab() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selected, setSelected] = useState<FeedEvent | null>(null);

  useEffect(() => {
    const sb = createBrowserClient();
    let mounted = true;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from('agent_activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (mounted && data) setEvents(data);
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (sb as any)
      .channel('feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activity_feed' }, (payload: { new: FeedEvent }) => {
        if (paused || !mounted) return;
        setEvents((prev) => [payload.new, ...prev].slice(0, 200));
      })
      .subscribe();

    return () => { mounted = false; channel.unsubscribe(); };
  }, [paused]);

  const filtered = events.filter((e) => {
    if (filter === 'attention' && !e.requires_attention) return false;
    if (selectedAgent !== 'all' && e.agent !== selectedAgent) return false;
    return true;
  });

  const agents = Array.from(new Set(events.map((e) => e.agent)));

  return (
    <div style={{ padding: 28, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={22} style={{ color: C.accent2 }} /> Feed de agentes
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Actividad en tiempo real de todos los agentes IA
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPaused(!paused)} style={{
            padding: '8px 16px', background: paused ? C.accent2 : C.card, color: paused ? '#fff' : C.text,
            border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? 'Reanudar' : 'Pausar'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>Todos ({events.length})</button>
        <button onClick={() => setFilter('attention')} style={chipStyle(filter === 'attention')}>
          Requiere atención ({events.filter((e) => e.requires_attention).length})
        </button>
        <div style={{ width: 1, background: C.border, margin: '0 4px' }} />
        <button onClick={() => setSelectedAgent('all')} style={chipStyle(selectedAgent === 'all')}>Todos los agentes</button>
        {agents.map((a) => (
          <button key={a} onClick={() => setSelectedAgent(a)} style={chipStyle(selectedAgent === a)}>{a}</button>
        ))}
      </div>

      {/* Layout: feed + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No hay eventos
            </div>
          )}
          {filtered.map((e) => {
            const Icon = SEVERITY_ICONS[e.severity];
            const color = SEVERITY_COLORS[e.severity];
            return (
              <div key={e.id} onClick={() => setSelected(e)} style={{
                background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`,
                borderRadius: 0, padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                outline: selected?.id === e.id ? `2px solid ${C.accent2}` : 'none',
              }}>
                <Icon size={16} style={{ color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {e.agent}
                    </span>
                    {e.brand_name && (
                      <span style={{ fontSize: 10, color: C.accent2 }}>{e.brand_name}</span>
                    )}
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
                      {timeAgo(e.created_at)}
                    </span>
                  </div>
                </div>
                {e.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumbnail_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 0 }} />
                )}
                {e.requires_attention && (
                  <span style={{ background: C.red, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 0, fontWeight: 700 }}>
                    !
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detalle</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Agente</span>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '2px 0 0' }}>{selected.agent}</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Evento</span>
              <p style={{ fontSize: 13, margin: '2px 0 0' }}>{selected.title}</p>
            </div>
            {selected.brand_name && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Brand</span>
                <p style={{ fontSize: 13, margin: '2px 0 0', color: C.accent2 }}>{selected.brand_name}</p>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Detalles</span>
              <pre style={{ fontSize: 11, background: C.bg1, padding: 10, borderRadius: 0, marginTop: 4, overflow: 'auto', maxHeight: 240 }}>
                {JSON.stringify(selected.details, null, 2)}
              </pre>
            </div>
            <div>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Hora</span>
              <p style={{ fontSize: 12, margin: '2px 0 0', color: C.muted }}>
                {new Date(selected.created_at).toLocaleString('es-ES')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLE HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const navBtn: React.CSSProperties = {
  padding: '6px 10px', background: C.card, border: `1px solid ${C.border}`,
  color: C.text, borderRadius: 0, cursor: 'pointer',
};
const pill: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px', background: C.bg1, color: C.muted,
  borderRadius: 0, textTransform: 'uppercase', letterSpacing: 0.5,
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: C.accent2, color: '#fff', border: 'none',
  borderRadius: 0, cursor: 'pointer', fontWeight: 600,
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer',
};
function actBtn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: '14px 8px', background: C.card, border: 'none',
    color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}
function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', background: active ? C.accent2 : C.card, color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.accent2 : C.border}`, borderRadius: 0,
    cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type OperacionesTab = 'overview' | 'cola' | 'validacion' | 'agentes';
type IconProps = { size?: number; style?: React.CSSProperties };

const OPERACIONES_TABS: { key: OperacionesTab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'overview', title: 'Estadísticas', desc: 'Resumen diario', icon: BarChart },
  { key: 'cola', title: 'Cola', desc: 'Validar contenido', icon: Clipboard },
  { key: 'validacion', title: 'Validación', desc: 'Revisar propuestas', icon: Check },
  { key: 'agentes', title: 'Agentes', desc: 'Feed en vivo', icon: Radio },
];

export default function WorkerOperacionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as OperacionesTab) || 'overview';

  function setTab(t: OperacionesTab) {
    router.push(`/worker?tab=${t}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '48px 40px 40px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: C.text, lineHeight: 0.95, marginBottom: 8 }}>
          Operaciones
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>Tu panel de trabajo diario</p>
      </div>

      {/* Tab selector — Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
        {OPERACIONES_TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '28px 20px',
                background: active ? C.accent : C.card,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={28} style={{ color: active ? '#ffffff' : C.accent2 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#ffffff' : C.text }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : C.muted, marginTop: 4 }}>
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'cola' && <ColaTab />}
        {tab === 'validacion' && <ValidacionTab />}
        {tab === 'agentes' && <AgentesTab />}
      </div>
    </div>
  );
}
