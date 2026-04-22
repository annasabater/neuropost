'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export function LandingNav() {
  const [navShadow, setNavShadow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavShadow(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
    <>
      <nav style={{ boxShadow: navShadow ? '0 1px 0 #e5e7eb' : 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <Link href="/" className="nav-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-transparent.png" alt="NeuroPost" style={{ height: 36, width: 'auto', display: 'block' }} />
          <span className="nav-logo-text" style={{ fontFamily: fc, fontWeight: 800, fontSize: 'clamp(14px, 2vw, 20px)', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
            <span style={{ color: '#0c746c' }}>NEURO</span><span style={{ color: '#c8cbcd' }}>POST</span>
          </span>
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
          <li><Link href="/register" className="nav-cta">Empezar</Link></li>
        </ul>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}
      </nav>

      {isMobile && mobileMenuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, background: '#ffffff', zIndex: 9998, overflowY: 'auto', borderTop: '2px solid #111111' }}>

          <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 28px' }}>
            <p style={{ fontFamily: fc, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#0F766E', margin: '0 0 10px' }}>Producto</p>
            {[['/#funciones','Portfolio'],['/#sectores','Sectores'],['/#como-funciona','Cómo funciona'],['/#demo','Demo app']].map(([href, label]) => (
              <Link key={label} href={href} onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 17, fontWeight: 500, color: '#111', textDecoration: 'none', padding: '9px 0' }}>{label}</Link>
            ))}
            <Link href="/que-incluye" onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 17, fontWeight: 500, color: '#111', textDecoration: 'none', padding: '9px 0' }}>Qué incluye</Link>
          </div>

          <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 28px' }}>
            <p style={{ fontFamily: fc, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#0F766E', margin: '0 0 10px' }}>Impacto</p>
            {[['/#resultados','Resultados'],['/#testimonios','Clientes'],['/#faq','FAQ']].map(([href, label]) => (
              <Link key={label} href={href} onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 17, fontWeight: 500, color: '#111', textDecoration: 'none', padding: '9px 0' }}>{label}</Link>
            ))}
          </div>

          <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 28px' }}>
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 17, fontWeight: 600, color: '#111', textDecoration: 'none', padding: '4px 0' }}>Precios</Link>
          </div>

          <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 28px' }}>
            <p style={{ fontFamily: fc, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#0F766E', margin: '0 0 10px' }}>Empresa</p>
            {([['about','Sobre nosotros'],['about#valores','Valores'],['about#equipo','Equipo'],['about#contacto','Contacto'],['novedades','Novedades']] as [string,string][]).map(([href, label]) => (
              <Link key={label} href={`/${href}`} onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 17, fontWeight: 500, color: '#111', textDecoration: 'none', padding: '9px 0' }}>{label}</Link>
            ))}
          </div>

          <div style={{ padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: f, fontSize: 15, fontWeight: 600, color: '#111', textDecoration: 'none', textAlign: 'center', padding: '13px', border: '1px solid #e5e7eb' }}>Entrar</Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} style={{ display: 'block', fontFamily: fc, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff', background: '#0F766E', textDecoration: 'none', textAlign: 'center', padding: '15px' }}>Empezar →</Link>
          </div>

        </div>
      )}
    </>
  );
}
