'use client';
import { useEffect, useState } from 'react';

type Entry = { id: string; version: string | null; title: string; summary: string | null };

const LS_KEY = 'neuropost_last_seen_changelog';

export default function ChangelogModal() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [show, setShow]   = useState(false);

  useEffect(() => {
    fetch('/api/changelog/latest').then((r) => r.json()).then((d) => {
      if (!d.entry) return;
      const lastSeen = localStorage.getItem(LS_KEY);
      if (lastSeen !== d.entry.id) {
        setEntry(d.entry);
        setShow(true);
      }
    }).catch(() => null);
  }, []);

  function dismiss() {
    if (entry) localStorage.setItem(LS_KEY, entry.id);
    setShow(false);
  }

  if (!show || !entry) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b35', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {entry.version ? `Novedad v${entry.version}` : '🆕 Novedad'}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{entry.title}</div>
      {entry.summary && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>{entry.summary}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={dismiss} style={{ flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Cerrar
        </button>
        <a href="/novedades" onClick={dismiss} style={{ flex: 2, padding: '8px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Ver novedades →
        </a>
      </div>
    </div>
  );
}
