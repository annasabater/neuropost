'use client';

import { useState } from 'react';
import Link from 'next/link';

export function SiteFooter() {
  const [email, setEmail]     = useState('');
  const [subSent, setSubSent] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // TODO: wire to real API
    setSubSent(true);
  }

  return (
    <footer className="site-footer">
      <div className="container">

        {/* ─── 4 COLUMNS ─── */}
        <div className="footer-grid">

          {/* Column 1 — Brand */}
          <div className="footer-brand">
            <Link href="/" className="footer-logo">
              Neuro<span className="footer-logo-accent">Post</span>
            </Link>
            <p className="footer-brand-desc">
              El equipo que gestiona las redes de tu negocio local. Hecho con amor en España.
            </p>

            {/* Badge pill */}
            <div className="footer-badge-pill">
              <span className="footer-badge-dot" />
              +500 negocios activos
            </div>

            {/* Contact items */}
            <div className="footer-contact-list">
              <a href="mailto:neuropost.team@gmail.com" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                neuropost.team@gmail.com
              </a>
              <a href="tel:+34616773466" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                616 77 34 66
              </a>
              <a href="tel:+34672836666" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                672 83 66 66
              </a>
              <span className="footer-contact-item footer-contact-static">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Barcelona, España
              </span>
            </div>
          </div>

          {/* Column 2 — Producto */}
          <div>
            <div className="footer-col-title">Producto</div>
            <ul className="footer-links">
              <li><Link href="/#resultados">Resultados</Link></li>
              <li><Link href="/#como-funciona">Cómo funciona</Link></li>
              <li><Link href="/pricing">Precios</Link></li>
              <li>
                <Link href="/novedades" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Novedades
                  <span className="footer-new-badge">New</span>
                </Link>
              </li>
              <li><Link href="/#integraciones">Integraciones</Link></li>
            </ul>
          </div>

          {/* Column 3 — Empresa */}
          <div>
            <div className="footer-col-title">Empresa</div>
            <ul className="footer-links">
              <li><Link href="/about">Sobre nosotros</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/afiliados">Afiliados</Link></li>
              <li><Link href="/about#contacto">Contacto</Link></li>
              <li><a href="mailto:jobs@neuropost.es">Trabaja con nosotros</a></li>
              <li><Link href="/casos-de-exito">Casos de éxito</Link></li>
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <div className="footer-col-title">Legal</div>
            <ul className="footer-links">
              <li><Link href="/legal/privacidad">Privacidad</Link></li>
              <li><Link href="/legal/terminos">Términos</Link></li>
              <li><Link href="/legal/cookies">Cookies</Link></li>
              <li><Link href="/legal/aviso-legal">Aviso legal</Link></li>
              <li><Link href="/legal/privacidad#rgpd">RGPD</Link></li>
            </ul>
          </div>
        </div>

        {/* ─── CENTRAL BAND ─── */}
        <div className="footer-band">

          {/* Newsletter */}
          <div className="footer-newsletter">
            <p className="footer-newsletter-label">Novedades y consejos para tu negocio, cada semana</p>
            {subSent ? (
              <p className="footer-newsletter-ok">¡Suscrito! Te llegará pronto.</p>
            ) : (
              <form onSubmit={handleSubscribe} className="footer-newsletter-form">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="footer-newsletter-input"
                />
                <button type="submit" className="footer-newsletter-btn">Suscribirse</button>
              </form>
            )}
          </div>

          {/* Social icons */}
          <div className="footer-socials">
            <a href="https://instagram.com/neuropost.es" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/neuropost" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
            <a href="https://tiktok.com/@neuropost" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="TikTok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
              </svg>
            </a>
          </div>
        </div>

        {/* ─── BOTTOM BAR ─── */}
        <div className="footer-bottom">
          <span className="footer-bottom-copy">© 2026 NeuroPost — Todos los derechos reservados</span>
          <span className="footer-bottom-trust">
            🔒 Datos protegidos&nbsp;&nbsp;·&nbsp;&nbsp;✓ RGPD compliant&nbsp;&nbsp;·&nbsp;&nbsp;⏱ Soporte 6 días/semana
          </span>
          <div className="footer-bottom-links">
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/cookies">Cookies</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
