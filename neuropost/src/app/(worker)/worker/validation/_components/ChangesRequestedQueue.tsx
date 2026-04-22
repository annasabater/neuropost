'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw, ChevronDown, ChevronRight, ArrowRight, MessageSquare, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';

const C = {
  bg1: '#f5f5f5', card: '#ffffff', border: '#E5E7EB',
  text: '#111111', muted: '#6B7280', accent: '#0F766E',
  warn: '#92400e', warnBg: '#fef3c7',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface IdeaBrief {
  id:         string;
  angle:      string;
  copy_draft: string | null;
  hook:       string | null;
  format:     string;
}

interface ChangeItem {
  new_idea:      IdeaBrief & { hashtags: string[] | null };
  original_idea: IdeaBrief | null;
  brand_id:      string;
  brand_name:    string | null;
  week_id:       string;
  comment:       string | null;
  created_at:    string;
}

export function ChangesRequestedQueue() {
  const router = useRouter();
  const [items, setItems]       = useState<ChangeItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/worker/validation/changes-requested');
      const data = await res.json() as { items?: ChangeItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar');
      setItems(data.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: f }}>Cargando cambios pedidos…</div>;
  }
  if (items.length === 0) {
    return <EmptyState onReload={() => void load()} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, fontFamily: f }}>
          {items.length} variacion{items.length !== 1 ? 'es' : ''} pendiente{items.length !== 1 ? 's' : ''} de tu revisión
        </p>
        <button onClick={() => void load()} style={outlineBtn}>
          <RefreshCw size={13} /> Recargar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => {
          const open = expanded.has(it.new_idea.id);
          return (
            <div key={it.new_idea.id} style={card}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <button
                  type="button"
                  onClick={() => toggle(it.new_idea.id)}
                  style={chevBtn}
                  aria-label={open ? 'Colapsar' : 'Expandir'}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: f }}>
                    {it.brand_name ?? it.brand_id}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: f }}>
                    {timeAgo(it.created_at)} · {it.comment ? 'con comentario del cliente' : 'sin comentario'}
                  </div>
                </div>
                <span style={pillAwaiting}>Cambio pedido</span>
                <button
                  type="button"
                  onClick={() => router.push(`/worker/weekly-plans/${it.week_id}`)}
                  style={atenderBtn}
                >
                  Atender <ArrowRight size={13} />
                </button>
              </div>

              {/* Expanded body */}
              {open && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
                  {it.comment && (
                    <div style={commentBanner}>
                      <MessageSquare size={13} />
                      <span style={{ flex: 1 }}>{it.comment}</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <IdeaCol title="Idea original" idea={it.original_idea} muted />
                    <IdeaCol title="Nueva variación" idea={it.new_idea} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onReload }: { onReload: () => void }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <Inbox size={48} style={{ color: C.accent, margin: '0 auto 16px', display: 'block' }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: C.text, fontFamily: fc }}>
        Sin cambios pedidos
      </h2>
      <p style={{ color: C.muted, fontSize: 13, margin: '0 0 20px', fontFamily: f }}>
        Ninguna variación está esperando tu revisión.
      </p>
      <button onClick={onReload} style={outlineBtn}>
        <RefreshCw size={13} /> Recargar
      </button>
    </div>
  );
}

function IdeaCol({ title, idea, muted }: { title: string; idea: IdeaBrief | null; muted?: boolean }) {
  if (!idea) {
    return (
      <div style={{ ...ideaCol, opacity: 0.5 }}>
        <div style={ideaColTitle}>{title}</div>
        <p style={{ color: C.muted, fontSize: 12, fontStyle: 'italic', margin: 0, fontFamily: f }}>
          No disponible
        </p>
      </div>
    );
  }
  return (
    <div style={{ ...ideaCol, opacity: muted ? 0.75 : 1 }}>
      <div style={{ ...ideaColTitle, color: muted ? C.muted : C.accent }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, fontFamily: f }}>{idea.angle}</div>
      {idea.hook && (
        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginBottom: 6, fontFamily: f }}>
          {idea.hook}
        </div>
      )}
      {idea.copy_draft && (
        <div style={{ fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', fontFamily: f }}>
          {idea.copy_draft.slice(0, 300)}
          {idea.copy_draft.length > 300 ? '…' : ''}
        </div>
      )}
      <span style={formatPill}>{idea.format}</span>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)    return 'ahora mismo';
  if (m < 60)   return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const outlineBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit',
};
const atenderBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', background: C.accent, color: '#fff',
  border: 'none', borderRadius: 0, cursor: 'pointer',
  fontSize: 13, fontWeight: 700, fontFamily: fc,
  textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
};
const card: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`,
};
const chevBtn: React.CSSProperties = {
  width: 24, height: 24, background: 'transparent',
  border: `1px solid ${C.border}`, color: C.muted,
  borderRadius: 0, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const pillAwaiting: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px', background: C.warnBg, color: C.warn,
  fontFamily: fc, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700,
};
const formatPill: React.CSSProperties = {
  display: 'inline-block', marginTop: 8,
  fontSize: 10, padding: '2px 6px', background: C.bg1, color: C.muted,
  fontFamily: fc, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};
const commentBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '10px 12px', background: C.warnBg, color: C.warn,
  fontSize: 13, fontFamily: f,
  border: `1px solid ${C.warn}33`, marginTop: 12, marginBottom: 12,
};
const ideaCol: React.CSSProperties = {
  padding: 12, background: C.bg1, border: `1px solid ${C.border}`,
};
const ideaColTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.06em', fontFamily: fc, marginBottom: 6,
  paddingBottom: 4, borderBottom: `1px solid ${C.border}`,
};
