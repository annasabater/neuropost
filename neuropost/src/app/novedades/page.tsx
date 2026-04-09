import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';
import { LandingNav } from '@/components/layout/LandingNav';
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

      {/* Footer — same as landing */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="nav-logo" style={{ color: '#f5f5f5' }}>NeuroPost</Link>
              <p>El equipo que gestiona las redes de tu negocio local.</p>
            </div>
            <div>
              <div className="footer-col-title">Producto</div>
              <ul className="footer-links">
                <li><Link href="/#funciones">Portfolio</Link></li>
                <li><Link href="/#precios">Precios</Link></li>
                <li><Link href="/novedades">Novedades</Link></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Empresa</div>
              <ul className="footer-links">
                <li><Link href="/about">Sobre nosotros</Link></li>
                <li><Link href="/about#contacto">Contacto</Link></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Legal</div>
              <ul className="footer-links">
                <li><Link href="/legal/privacidad">Privacidad</Link></li>
                <li><Link href="/legal/terminos">Términos</Link></li>
                <li><Link href="/legal/cookies">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 NeuroPost</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
