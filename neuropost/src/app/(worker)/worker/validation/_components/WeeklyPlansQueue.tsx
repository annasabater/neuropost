'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const C = {
  bg1: '#f5f5f5', card: '#ffffff', border: '#E5E7EB',
  text: '#111111', muted: '#6B7280', accent: '#0F766E',
};

interface PendingPlan {
  id:          string;
  brand_id:    string;
  week_start:  string;
  status:      string;
  created_at:  string;
  ideas_count: number;
  brands?:     { name: string };
}

export function WeeklyPlansQueue() {
  const router = useRouter();
  const [plans, setPlans]     = useState<PendingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/worker/weekly-plans/pending');
      const data = await res.json() as { plans?: PendingPlan[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar planes');
      setPlans(data.plans ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div style={{ padding: 40, color: C.muted }}>Cargando planes pendientes...</div>;
  }

  if (plans.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Calendar size={48} style={{ color: C.accent, margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Sin planes pendientes</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 20px' }}>
          No hay planes semanales esperando revisión.
        </p>
        <button onClick={load} style={outlineBtn}>
          <RefreshCw size={13} /> Recargar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {plans.length} plan{plans.length !== 1 ? 'es' : ''} pendiente{plans.length !== 1 ? 's' : ''} de revisión
        </p>
        <button onClick={load} style={outlineBtn}>
          <RefreshCw size={13} /> Recargar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: `1px solid ${C.border}` }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              background: C.card,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                  {plan.brands?.name ?? plan.brand_id}
                </span>
                <span style={statusPill}>ideas_ready</span>
              </div>
              <div style={{ display: 'flex', gap: 16, color: C.muted, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} />
                  Semana del {formatWeek(plan.week_start)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: C.text }}>{plan.ideas_count}</span> ideas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} />
                  {timeAgo(plan.created_at)}
                </span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/worker/weekly-plans/${plan.id}`)}
              style={reviewBtn}
            >
              Revisar <ArrowRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'hace menos de 1h';
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const outlineBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit',
};
const reviewBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: C.accent, color: '#fff',
  border: 'none', borderRadius: 0, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
};
const statusPill: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', background: '#0f766e22', color: C.accent,
  borderRadius: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};
