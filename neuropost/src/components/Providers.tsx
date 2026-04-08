'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import CookieBanner from '@/components/ui/CookieBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  const setBrand        = useAppStore((s) => s.setBrand);
  const setBrandLoading = useAppStore((s) => s.setBrandLoading);

  useEffect(() => {
    const supabase = createBrowserClient();

    async function loadBrand() {
      // Only fetch brand if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBrand(null);
        setBrandLoading(false);
        return;
      }
      setBrandLoading(true);
      try {
        const res = await fetch('/api/brands');
        if (res.ok) {
          const json = await res.json();
          setBrand(json.brand ?? null);
        } else {
          setBrand(null);
        }
      } catch {
        setBrand(null);
      }
      setBrandLoading(false);
    }

    loadBrand();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        loadBrand();
      }
      if (event === 'SIGNED_OUT') {
        setBrand(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setBrand, setBrandLoading]);

  return (
    <PostHogProvider>
      {children}
      <CookieBanner />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0e1018',
            color: '#e8edf8',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '10px',
            border: '1px solid #1a1d2e',
          },
        }}
      />
    </PostHogProvider>
  );
}
