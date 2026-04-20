import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Precios y planes — NeuroPost',
  description: 'Gestión de redes sociales con IA desde 29€/mes. Planes Starter, Pro, Total y Agencia. Cancela cuando quieras.',
  openGraph: {
    title: 'Precios y planes — NeuroPost',
    description: 'Gestión de redes sociales con IA desde 29€/mes. Cancela cuando quieras.',
    url: 'https://neuropost.es/pricing',
    siteName: 'NeuroPost',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://neuropost.es/og', width: 1200, height: 630, alt: 'Planes y precios de NeuroPost' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Precios y planes — NeuroPost',
    description: 'Gestión de redes sociales con IA desde 29€/mes. Cancela cuando quieras.',
    images: ['https://neuropost.es/og'],
  },
  alternates: { canonical: 'https://neuropost.es/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
