'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const [navShadow, setNavShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ─── NAV ─── */}
      <nav style={{ boxShadow: navShadow ? '0 1px 0 #e5e7eb' : 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <a href="/" className="nav-logo">NeuroPost</a>
        <ul className="nav-links">
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="/#funciones" style={{ cursor: 'pointer' }}>Producto</a>
            <div data-drop style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', minWidth: 180, zIndex: 100, padding: '8px 0' }}>
              <a href="/#funciones" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Portfolio</a>
              <a href="/#sectores" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Sectores</a>
              <a href="/#como-funciona" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Cómo funciona</a>
            </div>
          </li>
          <li><a href="/#resultados">Resultados</a></li>
          <li><a href="/#precios">Precios</a></li>
          <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
            <a href="/#testimonios" style={{ cursor: 'pointer' }}>Empresa</a>
            <div data-drop style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', minWidth: 180, zIndex: 100, padding: '8px 0' }}>
              <Link href="/about" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Sobre nosotros</Link>
              <Link href="/about#valores" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Valores</Link>
              <Link href="/about#equipo" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Equipo</Link>
              <Link href="/about#contacto" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Contacto</Link>
              <a href="/#testimonios" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Clientes</a>
              <a href="/#faq" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>FAQ</a>
              <Link href="/novedades" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Novedades</Link>
            </div>
          </li>
          <li><LanguageSelector /></li>
          <li><Link href="/login" className="nav-login">Entrar</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      {/* ─── LEGAL CONTENT ─── */}
      <div style={{ paddingTop: '64px', minHeight: '100vh' }}>
        {children}
      </div>

      {/* ─── FOOTER ─── */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="nav-logo" style={{ color: 'var(--cream)' }}>
                <span className="logo-dot" />
                NeuroPost
              </Link>
              <p>IA para que los negocios locales gestionen sus redes sociales sin esfuerzo. Hecho con ❤️ en España.</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📧 hola@neuropost.es</a>
                <a href="tel:+34900000000" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif" }}>📞 +34 900 000 000</a>
              </div>
            </div>
            <div>
              <div className="footer-col-title">Producto</div>
              <ul className="footer-links">
                <li><Link href="/#funciones">Funciones</Link></li>
                <li><Link href="/#como-funciona">Cómo funciona</Link></li>
                <li><Link href="/#precios">Precios</Link></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Empresa</div>
              <ul className="footer-links">
                <li><Link href="/about">Sobre nosotros</Link></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Afiliados</a></li>
                <li><Link href="/about#contacto">Contacto</Link></li>
                <li><a href="mailto:jobs@neuropost.es">Trabaja con nosotros</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Legal</div>
              <ul className="footer-links">
                <li><Link href="/legal/privacidad">Privacidad</Link></li>
                <li><Link href="/legal/terminos">Términos</Link></li>
                <li><Link href="/legal/cookies">Cookies</Link></li>
                <li><Link href="/legal/aviso-legal">Aviso legal</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 NeuroPost · Todos los derechos reservados</span>
            <span>Hecho en Barcelona 🇪🇸</span>
          </div>
        </div>
      </footer>
    </>
  );
}
