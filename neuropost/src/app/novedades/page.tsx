import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';
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
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "var(--font-barlow), 'Barlow', sans-serif" }}>
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 0' }}>
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 24px' }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 20, color: '#111827', textDecoration: 'none', fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>NeuroPost</Link>
        </div>
      </div>
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>Novedades</h1>
        <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 40 }}>Todo lo que añadimos y mejoramos en NeuroPost</p>
        <NovedadesClient entries={entries} />
      </div>
    </div>
  );
}
