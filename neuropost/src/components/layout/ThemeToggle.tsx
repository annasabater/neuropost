'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    (async () => {
      // Logged-in users: prefer their saved preference from user_metadata (cross-device)
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.theme) {
          const theme = user.user_metadata.theme as string;
          localStorage.setItem('theme', theme);
          const isDark = theme === 'dark';
          setDark(isDark);
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          return;
        }
      } catch { /* non-blocking */ }

      // Fallback: localStorage → system preference
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = saved ? saved === 'dark' : prefersDark;
      setDark(isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    })();
  }, []);

  async function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Persist to user_metadata for cross-device sync
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.auth.updateUser({ data: { theme } });
    } catch { /* non-blocking */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="topbar-icon-btn theme-toggle-btn"
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}