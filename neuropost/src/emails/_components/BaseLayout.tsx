import React from 'react';
import {
  Html, Head, Body, Container, Section,
  Text, Link, Hr, Preview,
} from '@react-email/components';

interface BaseLayoutProps {
  preview:  string;
  children: React.ReactNode;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>

          {/* ── Header ── */}
          <Section style={header}>
            <Link href={APP_URL} style={logo}>NeuroPost</Link>
          </Section>

          {/* ── Content ── */}
          <Section style={content}>
            {children}
          </Section>

          {/* ── Footer ── */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} NeuroPost · Plataforma de contenido para negocios locales
            </Text>
            <Text style={footerText}>
              Calle Gran Vía 1, 28013 Madrid, España
            </Text>
            <Text style={footerSmall}>
              Recibes este email porque tienes una cuenta activa en NeuroPost.{' '}
              <Link href={`${APP_URL}/dashboard/settings?tab=notifications`} style={footerLink}>
                Gestionar notificaciones
              </Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f5f5f5',
  fontFamily: "'Inter', Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '40px auto',
  backgroundColor: '#ffffff',
  border: '2px solid #111827',
};

const header: React.CSSProperties = {
  backgroundColor: '#111827',
  padding: '20px 32px',
};

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 800,
  textDecoration: 'none',
  letterSpacing: '-0.5px',
};

const content: React.CSSProperties = {
  padding: '32px',
};

const divider: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '0 32px',
};

const footer: React.CSSProperties = {
  padding: '20px 32px 32px',
};

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0 0 4px',
  lineHeight: '1.5',
};

const footerSmall: React.CSSProperties = {
  fontSize: '11px',
  color: '#d1d5db',
  margin: '8px 0 0',
};

const footerLink: React.CSSProperties = {
  color: '#9ca3af',
};
