'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

export function LandingNav() {
  const [navShadow, setNavShadow] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navDropdownPanelStyle: React.CSSProperties = {
    display: 'none',
    position: 'absolute',
    top: '100%',
    left: -10,
    background: 'rgba(255,255,255,0.98)',
    border: '1px solid #e5e7eb',
    minWidth: 230,
    zIndex: 100,
    padding: '10px',
    boxShadow: '0 18px 34px rgba(17,24,39,0.12)',
    backdropFilter: 'blur(6px)',
  };

  const navDropdownItemStyle: React.CSSProperties = {
    display: 'block',
    padding: '9px 10px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#374151',
    textDecoration: 'none',
    textTransform: 'none',
    borderBottom: '1px solid #f3f4f6',
  };

  return (
    <nav style={{ boxShadow: navShadow ? '0 1px 0 #e5e7eb' : 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
      <Link href="/" className="nav-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="NeuroPost" style={{ height: 36, width: 'auto', display: 'block' }} />
        <span>NeuroPost</span>
      </Link>
      <ul className="nav-links">
        <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
          <a href="/#funciones" style={{ cursor: 'pointer' }}>Producto</a>
          <div data-drop style={navDropdownPanelStyle}>
            <Link href="/#funciones" style={navDropdownItemStyle}>Portfolio</Link>
            <Link href="/#sectores" style={navDropdownItemStyle}>Sectores</Link>
            <Link href="/#como-funciona" style={navDropdownItemStyle}>Cómo funciona</Link>
            <Link href="/#demo" style={navDropdownItemStyle}>Demo app</Link>
            <Link href="/que-incluye" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>Qué incluye</Link>
          </div>
        </li>
        <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
          <a href="/#resultados" style={{ cursor: 'pointer' }}>Impacto</a>
          <div data-drop style={navDropdownPanelStyle}>
            <a href="/#resultados" style={navDropdownItemStyle}>Resultados</a>
            <a href="/#testimonios" style={navDropdownItemStyle}>Clientes</a>
            <a href="/#faq" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>FAQ</a>
          </div>
        </li>
        <li><a href="/pricing">Precios</a></li>
        <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
          <a href="/#testimonios" style={{ cursor: 'pointer' }}>Empresa</a>
          <div data-drop style={navDropdownPanelStyle}>
            <Link href="/about" style={navDropdownItemStyle}>Sobre nosotros</Link>
            <Link href="/about#valores" style={navDropdownItemStyle}>Valores</Link>
            <Link href="/about#equipo" style={navDropdownItemStyle}>Equipo</Link>
            <Link href="/about#contacto" style={navDropdownItemStyle}>Contacto</Link>
            <Link href="/novedades" style={{ ...navDropdownItemStyle, borderBottom: 'none' }}>Novedades</Link>
          </div>
        </li>
        <li><LanguageSelector /></li>
        <li><Link href="/login" className="nav-login">Entrar</Link></li>
        <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
      </ul>
    </nav>
  );
}
