const { randomUUID } = require('node:crypto');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://eu.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.instagram.com https://graph.facebook.com https://images.unsplash.com https://loremflickr.com https://*.staticflickr.com https://picsum.photos https://*.picsum.photos https://replicate.delivery https://*.replicate.delivery",
  "font-src 'self' https://fonts.gstatic.com",
  "media-src 'self' blob: https://*.supabase.co https://cdn.coverr.co https://*.coverr.co https://replicate.delivery https://*.replicate.delivery",
  "frame-src https://js.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://eu.posthog.com https://api.replicate.com https://graph.facebook.com https://graph.instagram.com",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.56.1'],

  generateBuildId: async () => 'build-' + randomUUID().replace(/-/g, '').slice(0, 12),

  transpilePackages: ['@neuropost/agents'],

  // ffmpeg/sharp/ioredis use native bindings or dynamic requires at runtime
  // that Turbopack can't bundle. Keep them out of the bundle.
  serverExternalPackages: [
    'ioredis',
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
  ],

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

module.exports = withNextIntl(nextConfig);
