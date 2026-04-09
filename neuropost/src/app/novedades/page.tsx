import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Novedades — NeuroPost',
  description: 'Todo lo que añadimos y mejoramos en NeuroPost. Nuevas funciones, mejoras y actualizaciones del producto.',
  openGraph: {
    title: 'Novedades — NeuroPost',
    description: 'Nuevas funciones, mejoras y actualizaciones de NeuroPost.',
    url: 'https://neuropost.es/novedades',
    siteName: 'NeuroPost',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://neuropost.es/og', width: 1200, height: 630, alt: 'Novedades de NeuroPost' }],
  },
  alternates: { canonical: 'https://neuropost.es/novedades' },
};
import { LandingNav } from '@/components/layout/LandingNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import NovedadesClient from './NovedadesClient';

async function getEntries() {
  const db = createAdminClient();
  const { data } = await db
    .from('changelog_entries')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

export default async function NovedadesPage() {
  const entries = await getEntries();
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* Nav — same as /about */}
      <LandingNav />

      {/* Hero */}
      <section style={{ padding: '140px 0 60px' }}>
        <div className="container" style={{ maxWidth: 740 }}>
          <h1 style={{ fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 4rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 0.95, color: '#111111', marginBottom: 12 }}>
            Novedades
          </h1>
          <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 17, color: '#6b7280', lineHeight: 1.7 }}>
            Todo lo que añadimos y mejoramos en NeuroPost
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container" style={{ maxWidth: 740 }}>
          <NovedadesClient entries={entries} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
