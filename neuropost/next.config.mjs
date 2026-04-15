// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://eu.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.instagram.com https://graph.facebook.com https://images.unsplash.com https://loremflickr.com https://*.staticflickr.com https://picsum.photos https://*.picsum.photos",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-src https://js.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://eu.posthog.com",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@neuropost/agents'],

  // ioredis and bullmq use native Node.js modules (net, tls, crypto).
  // Exclude them from Next.js bundling so they run as-is in the Node runtime.
  serverExternalPackages: ['ioredis', 'bullmq'],

  // Raíz del monorepo npm workspaces — Next 16 lo necesita explícito cuando el
  // package.json raíz declara workspaces y el lockfile vive un nivel arriba.
  turbopack: {
    root: path.join(__dirname, '..'),
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.instagram.com' },
      { protocol: 'https', hostname: 'graph.facebook.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control',   value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy',   value: CSP },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
