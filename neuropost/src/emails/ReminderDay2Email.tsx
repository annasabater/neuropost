import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface ReminderDay2EmailProps {
  brand_name:  string;
  review_url:  string;
}

export default function ReminderDay2Email({
  brand_name = 'tu negocio',
  review_url = 'https://neuropost.app/dashboard',
}: ReminderDay2EmailProps) {
  return (
    <BaseLayout preview="Recordatorio — tu plan de esta semana te espera">

      <Heading style={heading}>Tu plan de esta semana te espera</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Hace un par de días te enviamos la propuesta de contenido para esta semana. Todavía
        no hemos recibido tu respuesta.
      </Text>
      <Text style={body}>
        Si hay algo que quieras cambiar, ajustar o aprobar directamente, puedes hacerlo desde aquí:
      </Text>

      <Section style={ctaSection}>
        <Button href={review_url}>Ver propuesta</Button>
      </Section>

      <Text style={muted}>
        Quedan 4 días para que sigamos adelante con la versión original.
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
