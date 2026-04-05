'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Change = { type: 'new' | 'improved' | 'fixed' | 'removed'; text: string };
type Entry = { id: string; version: string | null; title: string; summary: string | null; changes: Change[]; published_at: string | null };

const TYPE_CONFIG = {
  new:      { icon: '✨', label: 'NUEVO',     color: '#065f46', bg: '#d1fae5' },
  improved: { icon: '🔧', label: 'MEJORADO',  color: '#1d4ed8', bg: '#dbeafe' },
  fixed:    { icon: '🐛', label: 'CORREGIDO', color: '#92400e', bg: '#fef3c7' },
  removed:  { icon: '🗑', label: 'ELIMINADO', color: '#6b7280', bg: '#f3f4f6' },
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
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        {[{ v: 'all', l: 'Todos' }, { v: 'new', l: '✨ Nuevo' }, { v: 'improved', l: '🔧 Mejorado' }, { v: 'fixed', l: '🐛 Corregido' }].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: filter === v ? '#ff6b35' : '#f3f4f6', color: filter === v ? '#fff' : '#374151' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {filteredEntries.map((entry) => {
          const byType: Record<string, Change[]> = {};
          for (const c of (Array.isArray(entry.changes) ? entry.changes : [])) {
            if (!byType[c.type]) byType[c.type] = [];
            byType[c.type].push(c);
          }
          return (
            <div key={entry.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '28px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                {entry.version && <span style={{ fontWeight: 800, fontSize: 13, color: '#ff6b35', background: '#fff8f5', border: '1px solid #ffcdb5', borderRadius: 6, padding: '2px 8px' }}>v{entry.version}</span>}
                {entry.published_at && <span style={{ fontSize: 13, color: '#9ca3af' }}>{new Date(entry.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: entry.summary ? 8 : 16 }}>{entry.title}</h2>
              {entry.summary && <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{entry.summary}</p>}
              {Object.entries(byType).map(([type, changes]) => {
                const conf = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.improved;
                return (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '3px 10px', borderRadius: 6, background: conf.bg }}>
                      <span>{conf.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: conf.color, letterSpacing: 0.5 }}>{conf.label}</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {changes.map((c, i) => (
                        <li key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          );
        })}
        {filteredEntries.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>Sin entradas con este filtro</p>}
      </div>

      {/* Subscribe */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '28px 32px', textAlign: 'center', marginTop: 48 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Recibe un email con cada novedad</div>
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Te avisamos cuando publiquemos novedades importantes</div>
        {subscribed ? <div style={{ color: '#059669', fontWeight: 700 }}>✅ ¡Suscrito!</div> : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" type="email"
              onKeyDown={(e) => e.key === 'Enter' && subscribe()}
              style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', width: 240 }} />
            <button onClick={subscribe} style={{ padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Suscribirme →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
