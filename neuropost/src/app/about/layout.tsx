import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre nosotros — NeuroPost',
  description: 'Conoce al equipo detrás de NeuroPost. Nacidos en Barcelona para ayudar a los negocios locales a crecer en redes sociales sin perder tiempo.',
  openGraph: {
    title: 'Sobre nosotros — NeuroPost',
    description: 'El equipo que lleva las redes de más de 200 negocios en España.',
    url: 'https://neuropost.es/about',
  },
  alternates: { canonical: 'https://neuropost.es/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
