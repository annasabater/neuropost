import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface ReminderDay4EmailProps {
  brand_name: string;
  review_url: string;
  days_left:  number;
}

export default function ReminderDay4Email({
  brand_name = 'tu negocio',
  review_url = 'https://neuropost.app/dashboard',
  days_left  = 2,
}: ReminderDay4EmailProps) {
  return (
    <BaseLayout preview={`Tu plan de la semana sin revisar — quedan ${days_left} días`}>

      <Heading style={heading}>Quedan {days_left} días para revisar tu plan</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Tu propuesta de contenido sigue esperando. Nos quedan {days_left} días antes de que
        sigamos adelante con lo que hemos preparado.
      </Text>
      <Text style={body}>
        Si quieres cambiar algo — un ángulo, un formato, una idea que no te convence — ahora
        es el momento:
      </Text>

      <Section style={ctaSection}>
        <Button href={review_url}>Revisar ahora</Button>
      </Section>

      <Text style={muted}>
        Si no revisas antes del día 6, aplicaremos la propuesta original tal como está.
      </Text>

    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 20px', lineHeight: '1.3',
};
const body: React.CSSProperties = {
  fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px',
};
const muted: React.CSSProperties = {
  fontSize: '13px', color: '#9ca3af', lineHeight: '1.5', margin: '16px 0 0',
};
const ctaSection: React.CSSProperties = { margin: '24px 0' };
