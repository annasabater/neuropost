import React from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { BaseLayout }             from './_components/BaseLayout';
import { Button }                 from './_components/Button';

export interface FinalWarningDay6EmailProps {
  brand_name: string;
  review_url: string;
}

export default function FinalWarningDay6Email({
  brand_name = 'tu negocio',
  review_url = 'https://neuropost.app/dashboard',
}: FinalWarningDay6EmailProps) {
  return (
    <BaseLayout preview="Último aviso — si hoy no respondes, seguimos con la propuesta original">

      <Heading style={heading}>Último aviso — hoy es el último día</Heading>

      <Text style={body}>Hola {brand_name},</Text>
      <Text style={body}>
        Llevamos 6 días con tu propuesta de esta semana lista y sin respuesta. Hoy es el último
        día para revisarla.
      </Text>
      <Text style={body}>
        Si no nos dices nada antes de esta noche, seguiremos adelante con lo que hemos preparado
        y lo pondremos en producción tal como está.
      </Text>

      <Section style={ctaSection}>
        <Button href={review_url}>Revisar antes de que sea tarde</Button>
      </Section>

      <Text style={muted}>
        Si estás conforme con la propuesta original, no tienes que hacer nada.
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
