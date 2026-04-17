'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Menu, Bell, Search, X } from 'lucide-react';
import { ProgressLink } from '@/components/ui/ProgressLink';
import { getWorkerRouteLabel } from '@/components/worker/navigation';
import { usePathname, useRouter } from 'next/navigation';

const f = "var(--font-barlow), 'Barlow', sans-serif";

type SearchResult = { type: string; id: string; title: string; subtitle: string; href: string };

interface WorkerTopNavProps {
  pathname: string;
  onToggleSidebar: () => void;
}

export function WorkerTopNav({
  pathname,
  onToggleSidebar,
}: WorkerTopNavProps) {
  const title = getWorkerRouteLabel(pathname);
  const currentPath = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch('/api/worker/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.notifications ?? []).filter((n: { read: boolean }) => !n.read).length;
        setUnread(count);
      } catch { /* ignore */ }
    }
    fetchUnread();
  }, [currentPath]);

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/worker/search?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      setSearchResults(d.results ?? []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleResultClick(href: string) {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(href);
  }

  const TYPE_ICONS: Record<string, string> = { cliente: '👤', post: '📄', ticket: '🎫', job: '⚙️', solicitud: '📩' };

  return (
    <header className="dash-topbar worker-topbar">
      <button type="button" className="sidebar-toggle-btn" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      <div className="worker-topbar-context">
        <span className="worker-topbar-title">{title}</span>
      </div>

      {/* Global Search */}
      <div ref={searchRef} style={{ position: 'relative', marginLeft: 'auto', marginRight: 12 }}>
        {!searchOpen ? (
          <button type="button" onClick={() => setSearchOpen(true)} className="topbar-icon-btn" aria-label="Buscar" title="Buscar" style={{ display: 'inline-flex' }}>
            <Search size={17} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', padding: '4px 10px', minWidth: 280 }}>
            <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Buscar clientes, posts, tickets, jobs..."
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: f, fontSize: 13, color: '#111' }}
            />
            <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Results dropdown */}
        {searchOpen && (searchResults.length > 0 || searching) && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            width: 360, background: '#ffffff', border: '1px solid #e5e7eb',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 200,
            maxHeight: 400, overflowY: 'auto',
          }}>
            {searching && <div style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>Buscando...</div>}
            {searchResults.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => handleResultClick(r.href)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '10px 14px',
                  border: 'none', borderBottom: '1px solid #f3f4f6', background: '#ffffff',
                  cursor: 'pointer', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[r.type] ?? '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.subtitle}</div>
                </div>
                <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{r.type}</span>
              </button>
            ))}
            {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>Sin resultados</div>
            )}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <ProgressLink
          href="/worker/inbox"
          className="topbar-icon-btn"
          aria-label="Inbox"
          title="Inbox"
          style={{ position: 'relative', display: 'inline-flex' }}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </ProgressLink>
      </div>
    </header>
  );
}
