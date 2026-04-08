'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Wrench, Bug, Trash2 } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Change = { type: 'new' | 'improved' | 'fixed' | 'removed'; text: string };
type Entry = { id: string; version: string | null; title: string; summary: string | null; changes: Change[]; published_at: string | null };

const TYPE_CONFIG = {
  new:      { icon: Sparkles, label: 'NUEVO',     color: '#0F766E', bg: '#f0fdf4' },
  improved: { icon: Wrench,   label: 'MEJORADO',  color: '#1565c0', bg: '#e3f2fd' },
  fixed:    { icon: Bug,      label: 'CORREGIDO', color: '#e65100', bg: '#fff3e0' },
  removed:  { icon: Trash2,   label: 'ELIMINADO', color: '#6b7280', bg: '#f3f4f6' },
};

export default function NovedadesClient({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  async function subscribe() {
    if (!email.includes('@')) { toast.error('Email inválido'); return; }
    const res = await fetch('/api/changelog/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.ok) { setSubscribed(true); toast.success('¡Suscrito!'); }
  }

  const filteredEntries = filter === 'all' ? entries
    : entries.filter((e) => Array.isArray(e.changes) && e.changes.some((c) => c.type === filter));

  return (
    <>
      {/* Filters — underline tabs */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 40, borderBottom: '1px solid #e5e7eb' }}>
        {[{ v: 'all', l: 'Todos' }, { v: 'new', l: 'Nuevo' }, { v: 'improved', l: 'Mejorado' }, { v: 'fixed', l: 'Corregido' }].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12,
            fontFamily: f, fontSize: 13, fontWeight: 500,
            color: filter === v ? '#111827' : '#9ca3af',
            borderBottom: filter === v ? '2px solid #111827' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {l}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 1, background: '#e5e7eb' }} />

        {filteredEntries.map((entry) => {
          const byType: Record<string, Change[]> = {};
          for (const c of (Array.isArray(entry.changes) ? entry.changes : [])) {
            if (!byType[c.type]) byType[c.type] = [];
            byType[c.type].push(c);
          }
          return (
            <div key={entry.id} style={{ position: 'relative', marginBottom: 40 }}>
              {/* Timeline dot */}
              <div style={{ position: 'absolute', left: -28, top: 4, width: 10, height: 10, background: '#111827', borderRadius: '50%' }} />

              {/* Date + version */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {entry.published_at && (
                  <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
                    {new Date(entry.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
                {entry.version && (
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, color: '#0F766E', background: '#f0fdf4', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    v{entry.version}
                  </span>
                )}
              </div>

              {/* Card */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: '24px 28px' }}>
                <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', marginBottom: entry.summary ? 8 : 20 }}>
                  {entry.title}
                </h2>
                {entry.summary && (
                  <p style={{ fontFamily: f, color: '#6b7280', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{entry.summary}</p>
                )}

                {Object.entries(byType).map(([type, changes]) => {
                  const conf = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.improved;
                  const Icon = conf.icon;
                  return (
                    <div key={type} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '3px 10px', background: conf.bg }}>
                        <Icon size={11} color={conf.color} />
                        <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, color: conf.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{conf.label}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {changes.map((c, i) => (
                          <li key={i} style={{ fontFamily: f, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{c.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827', marginBottom: 6 }}>Nada por aquí todavía</p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af' }}>Estamos trabajando en nuevas mejoras</p>
          </div>
        )}
      </div>

      {/* Subscribe CTA */}
      <div style={{ background: '#111827', padding: '32px 40px', textAlign: 'center', marginTop: 48 }}>
        <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 20, textTransform: 'uppercase', color: '#ffffff', marginBottom: 6 }}>
          No te pierdas ninguna mejora
        </p>
        <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
          Recibe un email cuando lancemos nuevas funcionalidades
        </p>
        {subscribed ? (
          <p style={{ fontFamily: f, fontWeight: 600, color: '#0F766E', fontSize: 14 }}>Suscrito correctamente</p>
        ) : (
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', maxWidth: 400, margin: '0 auto' }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" type="email"
              onKeyDown={(e) => e.key === 'Enter' && subscribe()}
              style={{ flex: 1, padding: '12px 16px', border: '1px solid #374151', background: '#1f2937', color: '#ffffff', fontFamily: f, fontSize: 14, outline: 'none' }} />
            <button onClick={subscribe} style={{
              padding: '12px 24px', background: '#ffffff', color: '#111827', border: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
            }}>
              Suscribirme
            </button>
          </div>
        )}
      </div>
    </>
  );
}
