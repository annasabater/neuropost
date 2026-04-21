import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export type PostNotificationEmailType =
  | 'post.ready_for_review'
  | 'post.rejected'
  | 'post.ready_auto'
  | 'post.reanalysis_done';

export interface PostNotificationEmailProps {
  brand_name:  string;
  type:        PostNotificationEmailType;
  heading:     string;
  body:        string;
  cta_url:     string;
  cta_label:   string;
  reason?:     string;  // only for post.rejected
}

export default function PostNotificationEmail({
  brand_name = 'tu negocio',
  type       = 'post.ready_for_review',
  heading:   headingText = 'Tu publicación está lista',
  body:      bodyText    = 'Tienes una actualización en tu post.',
  cta_url    = 'https://neuropost.app/dashboard',
  cta_label  = 'Ver publicación',
  reason,
}: PostNotificationEmailProps) {
  return (
    <BaseLayout preview={headingText}>

      <Heading style={styles.heading}>{headingText}</Heading>

      <Text style={styles.body}>Hola {brand_name},</Text>
      <Text style={styles.body}>{bodyText}</Text>

      {type === 'post.rejected' && reason && (
        <Text style={styles.reason}>
          <strong>Motivo:</strong> {reason}
        </Text>
      )}

      <Section style={styles.ctaSection}>
        <Button href={cta_url}>{cta_label}</Button>
      </Section>

      {/* TODO: Replace with final brand copy once design system is confirmed */}
      <Text style={styles.muted}>
        Si tienes dudas, responde a este email o escríbenos desde la plataforma.
      </Text>

    </BaseLayout>
  );
}

const styles = {
  heading: {
    fontSize: '20px', fontWeight: 800, color: '#111827',
    margin: '0 0 20px', lineHeight: '1.3',
  } as React.CSSProperties,
  body: {
    fontSize: '15px', color: '#374151',
    lineHeight: '1.6', margin: '0 0 12px',
  } as React.CSSProperties,
  reason: {
    fontSize: '14px', color: '#374151',
    lineHeight: '1.6', margin: '0 0 16px',
    padding: '12px 16px', background: '#fef2f2',
    borderLeft: '3px solid #ef4444',
  } as React.CSSProperties,
  ctaSection: { margin: '24px 0' } as React.CSSProperties,
  muted: {
    fontSize: '13px', color: '#9ca3af',
    lineHeight: '1.5', margin: '16px 0 0',
  } as React.CSSProperties,
};
