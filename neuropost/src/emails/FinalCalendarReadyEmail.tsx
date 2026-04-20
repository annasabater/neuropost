import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface FinalCalendarReadyEmailProps {
  brand_name:       string;
  week_start_label: string;
  calendar_url:     string;
}

export default function FinalCalendarReadyEmail({
  brand_name       = 'tu negocio',
  week_start_label  = 'esta semana',
  calendar_url     = 'https://neuropost.app/dashboard',
}: FinalCalendarReadyEmailProps) {
  return (
    <BaseLayout preview="Tu calendario de publicación de la semana está listo">

      <Heading style={heading}>Tu calendario de la {week_start_label} está listo</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Ya tenemos cerrado el calendario de publicación para la {week_start_label}. Cada post
        tiene su día, su hora y su plataforma asignados.
      </Text>
      <Text style={body}>
        A partir de aquí nos encargamos de que todo salga a tiempo. Puedes seguir el progreso
        desde tu panel:
      </Text>

      <Section style={ctaSection}>
        <Button href={calendar_url}>Ver calendario</Button>
      </Section>

      <Text style={muted}>
        Si necesitas cambiar algo de última hora, escríbenos antes de la hora programada.
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
