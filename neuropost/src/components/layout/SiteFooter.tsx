import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="nav-logo" style={{ color: '#f5f5f5' }}>NeuroPost</Link>
            <p>El equipo que gestiona las redes de tu negocio local. Hecho con ❤️ en España.</p>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href="mailto:hola@neuropost.es" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', fontFamily: "var(--font-barlow), 'Barlow', sans-serif" }}>📧 hola@neuropost.es</a>
              <a href="tel:+34900000000" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', fontFamily: "var(--font-barlow), 'Barlow', sans-serif" }}>📞 +34 900 000 000</a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Producto</div>
            <ul className="footer-links">
              <li><Link href="/#resultados">Resultados</Link></li>
              <li><Link href="/#como-funciona">Cómo funciona</Link></li>
              <li><Link href="/pricing">Precios</Link></li>
              <li><Link href="/novedades">Novedades</Link></li>
            </ul>
          </div>
          <div>
            <div className="footer-col-title">Empresa</div>
            <ul className="footer-links">
              <li><Link href="/about">Sobre nosotros</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/afiliados">Afiliados</Link></li>
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
          <span>© 2026 NeuroPost · Todos los derechos reservados</span>
          <span>Hecho en Barcelona 🇪🇸</span>
        </div>
      </div>
    </footer>
  );
}
