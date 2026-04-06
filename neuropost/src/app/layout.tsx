import type { Metadata } from 'next';
import { Literata } from 'next/font/google';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { Providers } from '@/components/Providers';
import { PageProgressBar } from '@/components/ui/PageProgressBar';
import { validateEnv } from '@/lib/env';

validateEnv();

const literata = Literata({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-literata',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NeuroPost — Gestión de redes sociales con IA para negocios locales',
  description:
    'Llevamos Instagram y Facebook de tu negocio. La IA publica, responde comentarios y hace crecer tu cuenta. 14 días gratis, sin tarjeta.',
  keywords: ['gestión redes sociales', 'instagram para negocios', 'community manager ia', 'marketing negocios locales', 'automatizar instagram', 'facebook negocios'],
  openGraph: {
    title: 'NeuroPost — Tu negocio en redes, sin esfuerzo',
    description: 'Creamos y publicamos contenido para Instagram y Facebook de tu negocio local con IA.',
    url: 'https://neuropost.es',
    siteName: 'NeuroPost',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://neuropost.es/og', width: 1200, height: 630, alt: 'NeuroPost — Gestión de redes sociales con IA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NeuroPost — Gestión de redes sociales para negocios locales',
    description: 'Llevamos las redes de tu negocio mientras tú te centras en lo tuyo.',
    images: ['https://neuropost.es/og'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://neuropost.es' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale   = await getLocale();
  const messages = await getMessages();

  return (
    // suppressHydrationWarning prevents React complaining about data-theme set before hydration
    <html lang={locale} className={literata.variable} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NeuroPost" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'NeuroPost',
            description: 'Gestión de redes sociales con IA para negocios locales',
            url: 'https://neuropost.es',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '29', priceCurrency: 'EUR' },
            aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '200' },
          })}}
        />
      </head>
      <body>
        {/* Runs before React hydrates — prevents dark/light flash on load */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`}
        </Script>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PageProgressBar />
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
