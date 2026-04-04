'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

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
      <nav style={{ boxShadow: navShadow ? '0 4px 20px rgba(0,0,0,0.06)' : 'none' }}>
        <Link href="/" className="nav-logo">
          <span className="logo-dot" />
          NeuroPost
        </Link>
        <ul className="nav-links">
          <li><Link href="/#funciones">Funciones</Link></li>
          <li><Link href="/#como-funciona">Cómo funciona</Link></li>
          <li><Link href="/#precios">Precios</Link></li>
          <li><Link href="/#faq">FAQ</Link></li>
          <li><Link href="/about">Nosotros</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
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
