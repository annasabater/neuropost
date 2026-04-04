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
      setBrandLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('brands')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setBrand(data ?? null);
      }
      setBrandLoading(false);
    }

    loadBrand();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setBrandLoading(true);
        const { data } = await supabase
          .from('brands')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        setBrand(data ?? null);
        setBrandLoading(false);
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
            background: '#0f0e0c',
            color: '#faf8f3',
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontSize: '14px',
            fontWeight: '600',
            borderRadius: '10px',
          },
        }}
      />
    </PostHogProvider>
  );
}
