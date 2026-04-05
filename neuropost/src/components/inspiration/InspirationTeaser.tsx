'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Template = { id: string; title: string; thumbnail_url: string | null; format: string; };

export default function InspirationTeaser() {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch('/api/inspiracion/templates?limit=3')
      .then((r) => r.json())
      .then((d) => setTemplates((d.templates ?? []).slice(0, 3)));
  }, []);

  if (templates.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>¿Buscas inspiración?</h2>
        <Link href="/inspiracion" style={{ fontSize: '0.83rem', color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }}>
          Ver todas las ideas →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {templates.map((t) => (
          <Link key={t.id} href="/inspiracion" style={{ textDecoration: 'none', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', display: 'block' }}>
            <div style={{ height: 100, background: t.thumbnail_url ? `url(${t.thumbnail_url}) center/cover` : 'linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%)' }} />
            <div style={{ padding: '8px 10px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>{t.title}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>{t.format}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
