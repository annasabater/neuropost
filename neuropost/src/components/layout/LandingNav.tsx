'use client';

import Link from 'next/link';

export function LandingNav() {
  return (
    <nav style={{ boxShadow: 'none', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
      <Link href="/" className="nav-logo">NeuroPost</Link>
      <ul className="nav-links">
        <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
          <a href="/#funciones" style={{ cursor: 'pointer' }}>Producto</a>
          <div data-drop style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', minWidth: 180, zIndex: 100, padding: '8px 0' }}>
            <Link href="/#funciones" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Portfolio</Link>
            <Link href="/#sectores" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Sectores</Link>
            <Link href="/#como-funciona" style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: '#374151', textDecoration: 'none' }}>Cómo funciona</Link>
          </div>
        </li>
        <li><a href="/#resultados">Resultados</a></li>
        <li><a href="/#precios">Precios</a></li>
        <li style={{ position: 'relative' }} onMouseEnter={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'block'; }} onMouseLeave={(e) => { const d = e.currentTarget.querySelector('[data-drop]') as HTMLElement; if (d) d.style.display = 'none'; }}>
          <a style={{ cursor: 'pointer' }}>Empresa</a>
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
        <li><Link href="/login" className="nav-login">Entrar</Link></li>
        <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
      </ul>
    </nav>
  );
}
