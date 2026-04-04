'use client';
import { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const consent = localStorage.getItem('neuropost_cookies');
    if (consent !== 'all' && consent !== 'analytics') return;
    const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';
    if (!key) return;
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
      });
    }).catch(() => {});
  }, []);

  // Listen for consent given from CookieBanner
  useEffect(() => {
    function handleConsent() {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!key) return;
      import('posthog-js').then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com', capture_pageview: true, persistence: 'localStorage' });
        }
      }).catch(() => {});
    }
    window.addEventListener('neuropost:analytics-consent', handleConsent);
    return () => window.removeEventListener('neuropost:analytics-consent', handleConsent);
  }, []);

  return <>{children}</>;
}
