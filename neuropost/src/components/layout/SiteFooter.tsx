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

            {/* Badge pill — FIX 2 */}
            <div className="footer-badge-pill">
              <span className="footer-badge-dot" />
              <span>+500 negocios activos</span>
            </div>

            {/* Contact items — FIX 1 */}
            <div className="footer-contact-list">
              <a href="mailto:neuropost.team@gmail.com" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <span>neuropost.team@gmail.com</span>
              </a>
              <a href="tel:+34616773466" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>616 77 34 66</span>
              </a>
              <a href="tel:+34672836666" className="footer-contact-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>672 83 66 66</span>
              </a>
              <span className="footer-contact-item footer-contact-static">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>Barcelona, España</span>
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
                <Link href="/novedades">
                  Novedades<span className="footer-new-badge">New</span>
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

        {/* ─── CENTRAL BAND — FIX 3 + 4 ─── */}
        <div className="footer-band">

          {/* Label left */}
          <p className="footer-newsletter-label">
            Novedades y consejos<br />para tu negocio, cada semana
          </p>

          {/* Input + button — FIX 3 */}
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

          {/* Social icons — FIX 4 */}
          <div className="footer-socials">
            <a href="https://instagram.com/neuropost.es" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#888888">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/neuropost" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#888888">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a href="https://tiktok.com/@neuropost" target="_blank" rel="noopener noreferrer" className="footer-social-btn" aria-label="TikTok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#888888">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
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
