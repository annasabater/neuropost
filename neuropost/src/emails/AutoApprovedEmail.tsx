import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface AutoApprovedEmailProps {
  brand_name:       string;
  week_start_label: string;
  calendar_url:     string;
}

export default function AutoApprovedEmail({
  brand_name       = 'tu negocio',
  week_start_label  = 'esta semana',
  calendar_url     = 'https://neuropost.app/dashboard',
}: AutoApprovedEmailProps) {
  return (
    <BaseLayout preview="Hemos seguido adelante con tu plan semanal">

      <Heading style={heading}>Ya tenemos tu plan de la {week_start_label} en marcha</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Como no recibimos respuesta, hemos seguido adelante con la propuesta que preparamos
        para la {week_start_label}. Tu contenido está en producción.
      </Text>
      <Text style={body}>
        Puedes ver el calendario y, si algo no te cuadra, todavía puedes pedirle ajustes
        a tu equipo antes de que se publique.
      </Text>

      <Section style={ctaSection}>
        <Button href={calendar_url}>Ver calendario</Button>
      </Section>

    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 20px', lineHeight: '1.3',
};
const body: React.CSSProperties = {
  fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px',
};
const ctaSection: React.CSSProperties = { margin: '24px 0' };
