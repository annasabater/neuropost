// ─────────────────────────────────────────────────────────────────────────────
// PlatformScheduler — per-platform "cuándo publicar" picker.
//
// Drops into PostEditor between the platform picker and the Save button.
// Emits an array of { platform, scheduledAt } through onChange — the host
// form forwards it verbatim as the `publications` body of
// POST /api/posts/[id]/publications.
//
// Behaviour per platform card:
//   - "Publicar ahora"   → scheduledAt = null
//   - "Programar"        → scheduledAt = selected date+time
//   - "Sugerir óptima"   → GET /api/posts/suggest-times and fill the inputs
//
// Connection status is polled from /api/meta/status + /api/tiktok/status so
// a disconnected platform shows an inline "Conecta primero" CTA. Per the
// refactor contract, the card stays visible but the scheduler is disabled
// — the content is still generated, user just needs to connect.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, ExternalLink, Sparkles, Zap } from 'lucide-react';

// Stay in sync with src/lib/platforms/types.ts — duplicated here so this
// component is a pure client module with no server-side imports.
type Platform = 'instagram' | 'facebook' | 'tiktok';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface PlatformSchedule {
  platform:     Platform;
  /** null → publish immediately; ISO string → schedule at that instant. */
  scheduledAt:  string | null;
}

interface Props {
  /** Platforms selected by the user in the upstream platform picker. */
  platforms:  Platform[];
  /** Called every time the schedule changes (any platform, any field). */
  onChange:   (schedules: PlatformSchedule[]) => void;
  /** When true, disables all inputs (e.g. while the parent is saving). */
  disabled?:  boolean;
}

const META = {
  instagram: { emoji: '📷', label: 'Instagram', color: '#E1306C', settingsHash: '#redes' },
  facebook:  { emoji: '📘', label: 'Facebook',  color: '#1877F2', settingsHash: '#redes' },
  tiktok:    { emoji: '🎵', label: 'TikTok',    color: '#000000', settingsHash: '#redes' },
} as const;

interface ConnectionState {
  connected: boolean;
  username:  string | null;
}

export function PlatformScheduler({ platforms, onChange, disabled }: Props) {
  // One schedule entry per *currently selected* platform.
  const [schedules, setSchedules] = useState<Record<Platform, PlatformSchedule>>(() => ({
    instagram: { platform: 'instagram', scheduledAt: null },
    facebook:  { platform: 'facebook',  scheduledAt: null },
    tiktok:    { platform: 'tiktok',    scheduledAt: null },
  }));

  // Polled once on mount and after the user comes back from /settings.
  const [connections, setConnections] = useState<Record<Platform, ConnectionState>>(() => ({
    instagram: { connected: false, username: null },
    facebook:  { connected: false, username: null },
    tiktok:    { connected: false, username: null },
  }));
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [suggesting, setSuggesting] = useState(false);

  // Propagate only the schedules for the currently-selected platforms. If
  // the user unchecks a platform in the parent, its entry is dropped.
  const emitRef = useRef(onChange);
  emitRef.current = onChange;
  useEffect(() => {
    emitRef.current(platforms.map(p => schedules[p]));
  }, [platforms, schedules]);

  // ── Load connection status from existing endpoints ────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [metaRes, ttRes] = await Promise.all([
          fetch('/api/meta/status').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/tiktok/status').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (cancelled) return;
        setConnections({
          instagram: {
            connected: !!(metaRes?.instagram?.accountId ?? metaRes?.instagram?.connected),
            username:  metaRes?.instagram?.username ?? null,
          },
          facebook:  {
            connected: !!(metaRes?.facebook?.pageId  ?? metaRes?.facebook?.connected),
            username:  metaRes?.facebook?.pageName ?? null,
          },
          tiktok:    {
            connected: !!ttRes?.connected,
            username:  ttRes?.username ?? null,
          },
        });
      } finally {
        if (!cancelled) setLoadingConnections(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Schedule mutations ────────────────────────────────────────────────────
  function setScheduleFor(platform: Platform, iso: string | null) {
    setSchedules(prev => ({ ...prev, [platform]: { platform, scheduledAt: iso } }));
  }

  async function suggestTimesAll() {
    if (platforms.length === 0) return;
    setSuggesting(true);
    try {
      const qs   = platforms.join(',');
      const res  = await fetch(`/api/posts/suggest-times?platforms=${qs}`);
      const json = await res.json() as { suggestions?: Partial<Record<Platform, string>> };
      if (!json?.suggestions) return;
      setSchedules(prev => {
        const next = { ...prev };
        for (const p of platforms) {
          const iso = json.suggestions?.[p];
          if (iso) next[p] = { platform: p, scheduledAt: iso };
        }
        return next;
      });
    } finally {
      setSuggesting(false);
    }
  }

  if (platforms.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--border)', marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', background: '#111827',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{
          fontFamily: fc, fontWeight: 800, fontSize: 12, color: '#ffffff',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={13} /> Cuándo publicar
        </span>
        <button
          type="button"
          onClick={suggestTimesAll}
          disabled={disabled || suggesting}
          style={{
            padding: '4px 10px', background: 'transparent', color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.3)', fontFamily: f, fontSize: 11,
            cursor: disabled || suggesting ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: disabled || suggesting ? 0.6 : 1,
          }}
        >
          <Sparkles size={12} /> {suggesting ? 'Calculando…' : 'Sugerir horas óptimas'}
        </button>
      </div>

      {/* One card per selected platform */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {platforms.map((p) => (
          <PlatformCard
            key={p}
            platform={p}
            schedule={schedules[p]}
            connection={connections[p]}
            loadingConnection={loadingConnections}
            disabled={!!disabled}
            onChange={(iso) => setScheduleFor(p, iso)}
          />
        ))}
      </div>

      {/* Summary line */}
      <SummaryLine schedules={platforms.map(p => schedules[p])} />
    </div>
  );
}

// ─── Per-platform card ─────────────────────────────────────────────────────

function PlatformCard({
  platform, schedule, connection, loadingConnection, disabled, onChange,
}: {
  platform:          Platform;
  schedule:          PlatformSchedule;
  connection:        ConnectionState;
  loadingConnection: boolean;
  disabled:          boolean;
  onChange:          (iso: string | null) => void;
}) {
  const meta = META[platform];
  const isPublishNow = schedule.scheduledAt === null;

  // Split the ISO into date + time for two native inputs (nicest UX without
  // pulling in a full date-picker library).
  const [dateValue, timeValue] = useMemo(() => {
    if (!schedule.scheduledAt) return ['', ''];
    const d = new Date(schedule.scheduledAt);
    if (isNaN(d.getTime())) return ['', ''];
    const iso = d.toISOString();
    return [iso.slice(0, 10), iso.slice(11, 16)];
  }, [schedule.scheduledAt]);

  function recombine(nextDate: string, nextTime: string) {
    if (!nextDate) { onChange(null); return; }
    const time = nextTime || '10:00';
    const iso  = new Date(`${nextDate}T${time}:00`).toISOString();
    onChange(iso);
  }

  const notConnected = !loadingConnection && !connection.connected;
  const cellDisabled = disabled || notConnected;

  return (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
      background: notConnected ? '#fef7f0' : 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{meta.emoji}</span>
          <span style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {meta.label}
          </span>
          {!loadingConnection && connection.connected && connection.username && (
            <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
              @{connection.username}
            </span>
          )}
          {notConnected && (
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 8px', background: '#fef3e8', color: '#b45309',
              textTransform: 'uppercase',
            }}>
              Sin conectar
            </span>
          )}
        </span>

        {/* Now / Schedule toggle */}
        {!notConnected && (
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)' }}>
            <button
              type="button"
              disabled={cellDisabled}
              onClick={() => onChange(null)}
              style={segBtn(isPublishNow, cellDisabled)}
            >
              <Zap size={11} /> Ahora
            </button>
            <button
              type="button"
              disabled={cellDisabled}
              onClick={() => {
                // Default to tomorrow at 10:00 local time if nothing set yet
                const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
                onChange(d.toISOString());
              }}
              style={{ ...segBtn(!isPublishNow, cellDisabled), borderLeft: '1px solid var(--border)' }}
            >
              <Clock size={11} /> Programar
            </button>
          </div>
        )}
      </div>

      {notConnected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: f, fontSize: 12, color: '#92400e' }}>
            Genera igualmente el contenido. Para publicar aquí necesitas conectar {meta.label}.
          </span>
          <Link
            href={`/settings${meta.settingsHash}`}
            target="_blank"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', background: '#111827', color: '#fff',
              fontFamily: f, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Conectar <ExternalLink size={10} />
          </Link>
        </div>
      ) : !isPublishNow ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={dateValue}
            disabled={cellDisabled}
            onChange={e => recombine(e.target.value, timeValue)}
            style={inputStyle}
          />
          <input
            type="time"
            value={timeValue}
            disabled={cellDisabled}
            onChange={e => recombine(dateValue, e.target.value)}
            style={inputStyle}
          />
        </div>
      ) : (
        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
          Se publicará inmediatamente al guardar.
        </p>
      )}
    </div>
  );
}

// ─── Summary ────────────────────────────────────────────────────────────────

function SummaryLine({ schedules }: { schedules: PlatformSchedule[] }) {
  const now    = schedules.filter(s => s.scheduledAt === null);
  const later  = schedules.filter(s => s.scheduledAt !== null);
  if (schedules.length === 0) return null;

  return (
    <div style={{
      padding: '10px 16px', background: 'var(--bg-1)',
      fontFamily: f, fontSize: 12, color: 'var(--text-secondary)',
      borderTop: '1px solid var(--border)',
    }}>
      {now.length > 0 && <>🚀 <b>{now.length}</b> plataforma{now.length !== 1 ? 's' : ''} publicarán al guardar. </>}
      {later.length > 0 && <>⏰ <b>{later.length}</b> programada{later.length !== 1 ? 's' : ''}.</>}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function segBtn(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    background:  active ? '#111827'       : 'var(--bg)',
    color:       active ? '#ffffff'       : 'var(--text-secondary)',
    fontFamily:  f,
    fontSize:    11,
    fontWeight:  600,
    display:     'flex',
    alignItems:  'center',
    gap:         4,
    cursor:      disabled ? 'not-allowed' : 'pointer',
    opacity:     disabled ? 0.5 : 1,
    border:      'none',
  };
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  fontFamily: f,
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
};
