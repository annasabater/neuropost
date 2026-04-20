import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface WeeklyPlanReadyEmailProps {
  brand_name:      string;
  week_start_label: string;   // e.g. "semana del 21 de abril"
  review_url:      string;
  pillar_summary:  string;    // e.g. "3 posts de foto y 1 reel para esta semana"
}

export default function WeeklyPlanReadyEmail({
  brand_name      = 'tu negocio',
  week_start_label = 'esta semana',
  review_url      = 'https://neuropost.app/dashboard',
  pillar_summary  = 'una propuesta de contenido',
}: WeeklyPlanReadyEmailProps) {
  return (
    <BaseLayout preview={`Tu contenido de la ${week_start_label} está listo para revisar`}>

      <Heading style={heading}>Tu propuesta de la {week_start_label} está lista</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Ya tenemos preparada la propuesta de esta semana. Hemos trabajado {pillar_summary}.
      </Text>

      <Section style={ctaSection}>
        <Button href={review_url}>Revisar propuesta</Button>
      </Section>

      <Text style={body}>
        Échale un vistazo cuando puedas y dinos qué te cuadra y qué no. Cualquier cosa que quieras
        cambiar, la ajustamos.
      </Text>
      <Text style={muted}>
        Si no revisas la propuesta en los próximos 6 días, seguimos adelante con la versión original.
      </Text>

    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize:    '20px',
  fontWeight:  800,
  color:       '#111827',
  margin:      '0 0 20px',
  lineHeight:  '1.3',
};
const body: React.CSSProperties = {
  fontSize:    '15px',
  color:       '#374151',
  lineHeight:  '1.6',
  margin:      '0 0 12px',
};
const muted: React.CSSProperties = {
  fontSize:    '13px',
  color:       '#9ca3af',
  lineHeight:  '1.5',
  margin:      '16px 0 0',
};
const ctaSection: React.CSSProperties = {
  margin: '24px 0',
};
