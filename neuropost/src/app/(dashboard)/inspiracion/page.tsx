'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  /inspiracion — single unified page (no top-level tabs)
//
//  Mental model: client sees ONE stream of "things to request".
//  Origin (editorial / user_saved / ai_generated) is a FILTER, not a section.
//  The only two actions are:  ❤️ favorite  |  "Pedir esta pieza →"
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Plus, X, Search, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import { createBrowserClient } from '@/lib/supabase';
import { SEASON_CHIPS, FORMAT_CHIPS } from '@/components/inspiration/TagChipsBar';
import { InspirationCard, type InspirationItem } from '@/components/inspiration/InspirationCard';

// All known tags for smart search matching
const ALL_TAGS = [...SEASON_CHIPS, ...FORMAT_CHIPS];

// Normalize text for fuzzy matching (remove accents, lowercase)
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Format helpers ───────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  all: 'Todos', image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo',
};

// ─── Scope pills ──────────────────────────────────────────────────────────────

type Scope = 'all' | 'favorites' | 'user_saved' | 'editorial' | 'ai_generated' | 'telegram_bank';

const SCOPE_PILLS: { key: Scope; label: string }[] = [
  { key: 'all',            label: 'Todo' },
  { key: 'favorites',      label: 'Favoritos' },
  { key: 'user_saved',     label: 'Guardadas' },
  { key: 'editorial',      label: 'Sugerencias' },
  { key: 'telegram_bank',  label: 'Banco' },
];

// ─── Inspiration Bank item (from /api/inspiration/bank/list) ─────────────────
type BankItem = {
  id:               string;
  media_type:       'image' | 'carousel' | 'video';
  media_urls:       string[];
  thumbnail_url:    string | null;
  video_frames_urls: string[];
  category:         string;
  tags:             string[];
  dominant_colors:  string[];
  mood:             string | null;
  source_platform:  string | null;
  source_url:       string | null;
  created_at:       string;
};

type BankTab = 'foryou' | 'all';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InspiracionPage() {
  const brand      = useAppStore(s => s.brand);
  const planLimits = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowsVideo = planLimits.videosPerWeek > 0;
  const maxImages  = planLimits.carouselMaxPhotos;

  // ── Library state ──────────────────────────────────────────────────────────
  const [items,    setItems]    = useState<InspirationItem[]>([]);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [scope,    setScope]    = useState<Scope>('all');
  const [search,   setSearch]   = useState('');
  const [mediaFmt, setMediaFmt] = useState('');   // '' | 'image' | 'carousel' | 'video'
  const [tags,     setTags]     = useState<string[]>([]);

  // ── Telegram bank state (separate from the normal items list) ──────────────
  const [bankItems,   setBankItems]   = useState<BankItem[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankTab,     setBankTab]     = useState<BankTab>('foryou');

  // ── Bank viewer state (full-size preview) ─────────────────────────────────
  const [viewerOpen,   setViewerOpen]   = useState(false);
  const [viewerItem,   setViewerItem]   = useState<BankItem | null>(null);
  const [viewerSlide,  setViewerSlide]  = useState(0);

  function openViewer(item: BankItem) {
    setViewerItem(item);
    setViewerSlide(0);
    setViewerOpen(true);
  }

  // ── Remix modal state ──────────────────────────────────────────────────────
  const [remixOpen,      setRemixOpen]      = useState(false);
  const [remixItem,      setRemixItem]      = useState<BankItem | null>(null);
  const [remixPrompt,    setRemixPrompt]    = useState('');
  const [remixFormat,    setRemixFormat]    = useState<'image' | 'carousel' | 'reel'>('image');
  const [remixRunning,   setRemixRunning]   = useState(false);
  const [remixResult,    setRemixResult]    = useState<{ imageUrl: string; postId: string | null } | null>(null);

  function openRemix(item: BankItem) {
    setRemixItem(item);
    setRemixPrompt('');
    setRemixFormat('image');
    setRemixResult(null);
    setRemixOpen(true);
  }

  async function submitRemix() {
    if (!remixItem) return;
    if (!remixPrompt.trim()) { toast.error('Escribe qué quieres generar'); return; }
    setRemixRunning(true);
    try {
      const res = await fetch(`/api/inspiration/bank/${remixItem.id}/remix`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_prompt: remixPrompt, format: remixFormat }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? 'Error al generar');
        return;
      }
      setRemixResult({ imageUrl: json.data.imageUrl, postId: json.data.postId });
      toast.success('Imagen generada — revísala en Posts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setRemixRunning(false);
    }
  }

  // ── Search debounce ref ────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (opts?: {
    scope?: Scope; search?: string; mediaFmt?: string;
    tags?: string[]; page?: number;
  }) => {
    setLoading(true);
    const p = new URLSearchParams();
    const s  = opts?.scope    ?? scope;
    const q  = opts?.search   !== undefined ? opts.search   : search;
    const mf = opts?.mediaFmt !== undefined ? opts.mediaFmt : mediaFmt;
    const tg = opts?.tags     !== undefined ? opts.tags     : tags;
    const pg = opts?.page     ?? 1;

    p.set('scope', s);
    p.set('page',  String(pg));
    if (mf)           p.set('media_type', mf);
    if (q.trim())     p.set('search', q.trim());
    if (tg.length > 0) p.set('tags', tg.join(','));

    try {
      const res  = await fetch(`/api/inspiracion/list?${p}`);
      const json = await res.json() as { items: InspirationItem[]; total: number; pages: number };
      if (res.ok) { setItems(json.items ?? []); setPages(json.pages ?? 1); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [scope, search, mediaFmt, tags]);

  useEffect(() => { fetchItems(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Telegram bank ────────────────────────────────────────────────────
  const fetchBank = useCallback(async (opts?: { tab?: BankTab; search?: string }) => {
    setBankLoading(true);
    const tab = opts?.tab ?? bankTab;
    const q   = opts?.search !== undefined ? opts.search : search;
    const p   = new URLSearchParams();
    if (tab === 'all')  p.set('scope', 'all');
    if (q.trim())       p.set('search', q.trim());
    p.set('limit', '60');
    try {
      const res = await fetch(`/api/inspiration/bank/list?${p}`);
      if (res.ok) {
        const json = await res.json() as { items: BankItem[] };
        setBankItems(json.items ?? []);
      } else {
        setBankItems([]);
      }
    } catch { setBankItems([]); }
    finally { setBankLoading(false); }
  }, [bankTab, search]);

  // Refetch bank whenever the tab changes while in telegram_bank scope
  useEffect(() => {
    if (scope === 'telegram_bank') fetchBank({ tab: bankTab });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, bankTab]);

  // Realtime recreation updates
  const supabase = useMemo(() => createBrowserClient(), []);
  useEffect(() => {
    if (!brand?.id) return;
    const ch = supabase
      .channel(`inspi-recreations-${brand.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'recreation_requests', filter: `brand_id=eq.${brand.id}` },
        (payload: { new: { id: string; status: string; generated_images?: string[] } }) => {
          const u = payload.new;
          const patch = (list: InspirationItem[]) =>
            list.map(i => i.recreation?.id === u.id
              ? { ...i, recreation: { ...i.recreation!, status: u.status, generated_images: u.generated_images ?? [] } }
              : i);
          setItems(patch);
          if (u.status === 'revisar') toast.success('¡Tu recreación está lista para revisar!');
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [brand?.id, supabase]);

  // ── Filter helpers ─────────────────────────────────────────────────────────
  function setFilter(patch: { scope?: Scope; search?: string; mediaFmt?: string; tags?: string[]; page?: number }) {
    const next = {
      scope:    patch.scope    ?? scope,
      search:   patch.search   !== undefined ? patch.search   : search,
      mediaFmt: patch.mediaFmt !== undefined ? patch.mediaFmt : mediaFmt,
      tags:     patch.tags     !== undefined ? patch.tags     : tags,
      page:     patch.page     ?? 1,
    };
    if (patch.scope    !== undefined) setScope(next.scope);
    if (patch.search   !== undefined) setSearch(next.search);
    if (patch.mediaFmt !== undefined) setMediaFmt(next.mediaFmt);
    if (patch.tags     !== undefined) setTags(next.tags);
    setPage(next.page);
    fetchItems(next);
  }

  // ── Favorite toggle ────────────────────────────────────────────────────────
  async function handleFavorite(id: string, val: boolean) {
    // Optimistic
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: val } : i));
    const res = await fetch(`/api/inspiracion/referencias/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: val }),
    });
    if (!res.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: !val } : i));
      toast.error('Error al actualizar');
    }
  }

  // ── "Pedir esta pieza" modal ───────────────────────────────────────────────
  const [showRequest,    setShowRequest]    = useState(false);
  const [reqItem,        setReqItem]        = useState<InspirationItem | null>(null);
  const [reqFormat,      setReqFormat]      = useState('image');
  const [reqNotes,       setReqNotes]       = useState('');
  const [reqMedia,       setReqMedia]       = useState<SelectedMedia[]>([]);
  const [reqSlotCount,   setReqSlotCount]   = useState(4);
  type Slot = { include: boolean; note: string };
  const blankSlot = (): Slot => ({ include: true, note: '' });
  const [reqSlots,       setReqSlots]       = useState<Slot[]>(() => Array(4).fill(null).map(blankSlot));
  const [requesting,     setRequesting]     = useState(false);
  const [reqSuccess,     setReqSuccess]     = useState(false);

  function openRequest(item: InspirationItem) {
    setReqItem(item);
    setReqFormat(item.format ?? 'image');
    setReqNotes('');
    setReqMedia([]);
    setReqSlotCount(4);
    setReqSlots(Array(4).fill(null).map(blankSlot));
    setReqSuccess(false);
    setShowRequest(true);
  }

  async function handleRequest() {
    if (!reqItem) return;
    setRequesting(true);

    // If item is an AI proposal (no DB id), save as reference first
    let refId = reqItem.id.startsWith('ai-') ? null : reqItem.id;

    if (!refId) {
      const sr = await fetch('/api/inspiracion/referencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:          reqItem.type ?? 'ai_generated',
          title:         reqItem.title,
          thumbnail_url: reqItem.thumbnail_url,
          format:        reqFormat,
          notes:         reqItem.notes,
          origin:        'ai_generated',
        }),
      });
      if (sr.ok) { const sd = await sr.json(); refId = sd.reference?.id ?? null; }
    }

    // Build notes
    let notes = reqNotes.trim();
    if (reqFormat === 'carousel') {
      const lines = reqSlots.slice(0, reqSlotCount).map((s, i) =>
        `Slide ${i + 1}: ${s.include ? (s.note.trim() || 'basarse en la referencia') : 'NO HACER'}`
      );
      notes = `${notes ? notes + '\n\n' : ''}[CARRUSEL — ${reqSlotCount} slides]\n${lines.join('\n')}`;
    }

    // Queue recreation if we have a real ref
    if (refId) {
      const recRes = await fetch('/api/inspiracion/recrear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id:  refId,
          client_notes:  notes || null,
          media_urls:    reqMedia.map(m => m.url),
          style_to_adapt: [],
        }),
      });
      if (recRes.ok) {
        const rd = await recRes.json();
        if (rd.recreation) {
          setItems(p => p.map(i => i.id === refId
            ? { ...i, recreation: { id: rd.recreation.id, status: rd.recreation.status } }
            : i));
        }
      }
    }

    // Create post request(s)
    const ownUrls = reqMedia.map(m => m.url);
    const thumb   = reqItem.thumbnail_url;
    const meta    = JSON.stringify({
      from_inspiration: true,
      reference_id:     refId,
      request_kind:     'inspiration_recreation',
      format:           reqFormat,
      origin:           reqItem.origin,
    });

    if (reqFormat === 'carousel') {
      const activeSlots = reqSlots.slice(0, reqSlotCount).filter(s => s.include);
      for (let i = 0; i < activeSlots.length; i++) {
        await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption:      [`Pieza (${i + 1}/${activeSlots.length}) — ${reqItem.title}`, activeSlots[i].note].filter(Boolean).join(' — '),
            image_url:    ownUrls[i] ?? thumb ?? null,
            status:       'request', format: 'carousel',
            platform:     ['instagram'], scheduled_at: null,
            ai_explanation: meta,
          }),
        }).catch(() => null);
      }
    } else {
      await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption:      `${reqItem.title ?? 'Pieza'}${notes ? ' — ' + notes : ''}`,
          image_url:    ownUrls[0] ?? thumb ?? null,
          status:       'request', format: reqFormat,
          platform:     ['instagram'], scheduled_at: null,
          ai_explanation: meta,
        }),
      }).catch(() => null);
    }

    setReqSuccess(true);
    setTimeout(() => { setShowRequest(false); setReqSuccess(false); setRequesting(false); setReqMedia([]); }, 1800);
  }

  // ── Add reference modal ────────────────────────────────────────────────────
  const [showAdd,      setShowAdd]      = useState(false);
  const [addFormat,    setAddFormat]    = useState<'image' | 'reel' | 'carousel'>('image');
  const [addSource,    setAddSource]    = useState<'url' | 'upload'>('url');
  const [addUrl,       setAddUrl]       = useState('');
  const [addFile,      setAddFile]      = useState<File | null>(null);
  const [addOwnMedia,  setAddOwnMedia]  = useState<SelectedMedia[]>([]);
  const [addQty,       setAddQty]       = useState(1);
  const [addDesc,      setAddDesc]      = useState('');
  const [addSaving,    setAddSaving]    = useState(false);
  const [addSuccess,   setAddSuccess]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetAdd() { setAddFormat('image'); setAddSource('url'); setAddUrl(''); setAddFile(null); setAddOwnMedia([]); setAddQty(1); setAddDesc(''); }

  async function handleAdd() {
    const hasRef = (addSource === 'url' && addUrl.trim()) || (addSource === 'upload' && !!addFile);
    if (!hasRef) { toast.error('Pega una URL o sube una imagen'); return; }
    if (addFormat === 'reel' && !allowsVideo) { toast.error('Tu plan no incluye vídeos'); return; }
    setAddSaving(true);
    try {
      let thumbUrl: string | null = null;
      if (addSource === 'upload' && addFile) {
        const fd = new FormData(); fd.append('file', addFile);
        const up = await fetch('/api/inspiracion/upload', { method: 'POST', body: fd });
        if (up.ok) { const d = await up.json(); thumbUrl = d.url ?? null; }
      }
      const title = addDesc.trim().slice(0, 80) || `Referencia ${addFormat}`;
      const refRes = await fetch('/api/inspiracion/referencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:        addSource,
          source_url:  addSource === 'url' ? (addUrl || null) : null,
          thumbnail_url: thumbUrl,
          title, notes: addDesc.trim() || null, format: addFormat,
          origin:      'user_saved',
        }),
      });
      if (!refRes.ok) { const e = await refRes.json().catch(() => ({})); toast.error(`Error: ${e.error ?? refRes.status}`); setAddSaving(false); return; }
      const { reference: newRef } = await refRes.json();
      if (!newRef?.id) { toast.error('Respuesta inválida'); setAddSaving(false); return; }

      // Queue recreation
      const ownUrls = addOwnMedia.map(m => m.url);
      await fetch('/api/inspiracion/recrear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: newRef.id,
          client_notes: [addDesc.trim(), `[FORMATO] ${addFormat}`, `[CANTIDAD] ${addQty}`].filter(Boolean).join('\n'),
          media_urls:   ownUrls, style_to_adapt: [],
        }),
      }).catch(() => null);

      // Create post request(s)
      const postsN = addFormat === 'reel' ? 1 : addQty;
      const meta   = JSON.stringify({ from_inspiration: true, reference_id: newRef.id, request_kind: 'inspiration_recreation', format: addFormat, origin: 'user_saved' });
      for (let i = 0; i < postsN; i++) {
        await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: addDesc.trim() || `Recreación — ${addFormat}`, image_url: ownUrls[i] ?? ownUrls[0] ?? thumbUrl ?? null, status: 'request', format: addFormat, platform: ['instagram'], scheduled_at: null, ai_explanation: meta }),
        }).catch(() => null);
      }

      fetchItems();
      setAddSuccess(true);
      setTimeout(() => { setShowAdd(false); setAddSuccess(false); resetAdd(); }, 1800);
    } catch { toast.error('Error al enviar'); }
    finally { setAddSaving(false); }
  }

  const inputSt: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelSm: React.CSSProperties = { display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 };

  // Counts for scope pills
  const favCount = items.filter(i => i.is_favorite).length;

  const displayItems = items;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1000 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="dashboard-unified-header inspi-header" style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10 }}>
            Inspiración
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Guarda lo que te guste. Pide al equipo lo que quieras publicar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inspi-header-cta"
          style={{ background: '#0D9488', color: '#fff', border: 'none', padding: '10px 22px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Plus size={14} /> Guardar referencia
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="inspi-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 3, borderBottom: '1px solid var(--border)' }}>
        {/* Scope tabs */}
        <div className="inspi-scope-tabs" style={{ display: 'flex', flex: 1 }}>
          {SCOPE_PILLS.map(s => {
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter({ scope: s.key })}
                style={{
                  padding: '11px 16px',
                  border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--text-primary)' : 'transparent'}`,
                  background: 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 400,
                  cursor: 'pointer', letterSpacing: '0.01em',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'color 0.12s',
                  marginBottom: -1,
                }}
              >
                {s.label}
                {s.key === 'favorites' && favCount > 0 && (
                  <span style={{ background: '#D4537E', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                    {favCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Format — right side */}
        <div className="inspi-search-format" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              placeholder="Buscar…"
              className="inspi-search-input"
              onChange={e => {
                const v = e.target.value;
                setSearch(v);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => {
                  const norm = normalize(v.trim());
                  const matched = ALL_TAGS.filter(t =>
                    normalize(t.label).includes(norm) || normalize(t.key).includes(norm)
                  ).map(t => t.key);
                  if (matched.length > 0 && norm.length >= 3) {
                    setFilter({ tags: matched, search: '' });
                  } else {
                    setFilter({ search: v, tags: [] });
                  }
                }, 350);
              }}
              style={{ padding: '6px 26px 6px 26px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, outline: 'none', width: 160, boxSizing: 'border-box', borderRadius: 99 }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setFilter({ search: '', tags: [] }); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Format pills */}
          <div className="inspi-format-pills" style={{ display: 'flex', gap: 4 }}>
            {(['', 'image', 'carousel', 'video'] as const).map(fmt => (
              <button
                key={fmt || 'all'}
                type="button"
                onClick={() => setFilter({ mediaFmt: fmt })}
                style={{
                  padding: '4px 10px',
                  border: `1px solid ${mediaFmt === fmt ? 'var(--text-primary)' : 'var(--border)'}`,
                  borderRadius: 99,
                  background: mediaFmt === fmt ? 'var(--text-primary)' : 'transparent',
                  color: mediaFmt === fmt ? 'var(--bg)' : 'var(--text-tertiary)',
                  fontFamily: f, fontSize: 11, cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {fmt ? FORMAT_LABEL[fmt] : 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sub-tabs for Telegram bank scope ───────────────────────────────── */}
      {scope === 'telegram_bank' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14, marginBottom: 6 }}>
          {([
            { key: 'foryou', label: 'Para ti' },
            { key: 'all',    label: 'Explorar todo' },
          ] as { key: BankTab; label: string }[]).map(t => {
            const active = bankTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setBankTab(t.key)}
                style={{
                  padding: '6px 14px',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 99,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Results — Telegram bank branch ─────────────────────────────────── */}
      {scope === 'telegram_bank' ? (
        <div id="inspi-results" style={{ marginTop: 16 }}>
          {bankLoading && bankItems.length === 0 ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando banco…</p>
            </div>
          ) : bankItems.length === 0 ? (
            <div style={{ padding: '100px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
                Banco vacío
              </p>
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 360, margin: '0 auto' }}>
                {bankTab === 'foryou'
                  ? 'Aún no hay referencias para tu sector. Prueba con "Explorar todo".'
                  : 'El banco se alimenta automáticamente desde el bot de Telegram del equipo.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {bankItems.map(bi => (
                <div
                  key={bi.id}
                  className="bank-card"
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    background: 'var(--bg-2)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  onClick={() => openViewer(bi)}
                >
                  {bi.thumbnail_url || bi.media_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bi.thumbnail_url ?? bi.media_urls[0]}
                      alt={bi.mood ?? bi.category}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : null}
                  {/* Carousel/video slide count pill */}
                  {bi.media_type === 'carousel' && bi.media_urls.length > 1 && (
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      padding: '2px 8px',
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontFamily: fc, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.06em',
                    }}>
                      1/{bi.media_urls.length}
                    </div>
                  )}
                  {/* Bottom meta strip */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '20px 10px 8px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                  }}>
                    <p style={{
                      fontFamily: fc, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: '#fff', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {bi.category}
                    </p>
                    {bi.tags.length > 0 && (
                      <p style={{
                        fontFamily: f, fontSize: 10, color: 'rgba(255,255,255,0.8)', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {bi.tags.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </div>
                  {/* Media-type badge */}
                  {bi.media_type !== 'image' && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      padding: '2px 7px',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      fontFamily: fc, fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {bi.media_type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div id="inspi-results" style={{ marginTop: 16 }}>
        {loading && items.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando…</p>
          </div>
        ) : displayItems.length === 0 ? (
          <div style={{ padding: '100px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
              {scope === 'favorites' ? 'Sin favoritos aún' : 'Sin referencias'}
            </p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 320, margin: '0 auto 24px' }}>
              {scope === 'favorites'
                ? 'Marca con el corazon lo que te guste y aparecera aqui.'
                : 'Guarda una referencia para empezar.'}
            </p>
            <button type="button" onClick={() => setShowAdd(true)} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '10px 22px', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer' }}>
              Guardar referencia
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {displayItems.map((item, idx) => (
                <InspirationCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  onFavorite={handleFavorite}
                  onRequest={openRequest}
                />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 32 }}>
                <button type="button" onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchItems({ page: p }); }} disabled={page === 1}
                  style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 99, background: 'transparent', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1 }}>← Anterior</button>
                {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button" onClick={() => { setPage(n); fetchItems({ page: n }); }}
                    style={{ minWidth: 34, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 99, background: n === page ? 'var(--text-primary)' : 'transparent', color: n === page ? 'var(--bg)' : 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                ))}
                <button type="button" onClick={() => { const p = Math.min(pages, page + 1); setPage(p); fetchItems({ page: p }); }} disabled={page === pages}
                  style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 99, background: 'transparent', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.3 : 1 }}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Pedir esta pieza
         ══════════════════════════════════════════════════════════════════════ */}
      {showRequest && reqItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', flex: 1 }}>
                Pedir: {reqItem.title ?? 'Pieza'}
              </h2>
              <button type="button" onClick={() => setShowRequest(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={20} /></button>
            </div>

            {reqSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ Solicitud enviada</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en ello.</p>
              </div>
            ) : (
              <>
                {/* Reference thumbnail */}
                {reqItem.thumbnail_url && (
                  <div style={{ marginBottom: 20 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={reqItem.thumbnail_url} alt="Referencia" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', border: '1px solid var(--border)' }} />
                  </div>
                )}

                {/* Format */}
                <div style={{ marginBottom: 18 }}>
                  <label style={labelSm}>Formato</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['image', 'carousel', 'reel', 'video'] as const).map(fmt => (
                      <button key={fmt} type="button"
                        onClick={() => { setReqFormat(fmt); if (fmt === 'carousel') { setReqSlotCount(4); setReqSlots(Array(4).fill(null).map(blankSlot)); } }}
                        style={{ padding: '8px 14px', border: `1px solid ${reqFormat === fmt ? '#111827' : 'var(--border)'}`, background: reqFormat === fmt ? '#111827' : 'var(--bg)', color: reqFormat === fmt ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {FORMAT_LABEL[fmt]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Carousel slots */}
                {reqFormat === 'carousel' && (
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelSm}>Número de slides</label>
                    <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
                      {[2,3,4,5,6].map((n, i, arr) => (
                        <button key={n} type="button" onClick={() => { setReqSlotCount(n); setReqSlots(Array(n).fill(null).map(blankSlot)); }}
                          style={{ minWidth: 42, padding: '7px 0', border: '1px solid var(--border)', borderRight: i < arr.length - 1 ? 'none' : undefined, background: reqSlotCount === n ? '#111827' : 'var(--bg)', color: reqSlotCount === n ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {reqSlots.slice(0, reqSlotCount).map((slot, i) => (
                        <div key={i} style={{ border: '1px solid var(--border)', padding: '10px 12px', background: slot.include ? 'var(--bg)' : 'var(--bg-1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: slot.include ? 6 : 0 }}>
                            <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 11, color: slot.include ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase', minWidth: 48 }}>Slide {i + 1}</span>
                            <button type="button" onClick={() => setReqSlots(s => s.map((x, j) => j === i ? { ...x, include: !x.include } : x))}
                              style={{ padding: '2px 8px', border: `1px solid ${slot.include ? 'var(--accent)' : 'var(--border)'}`, background: slot.include ? 'var(--accent-soft)' : 'var(--bg-2)', color: slot.include ? 'var(--accent)' : 'var(--text-tertiary)', fontFamily: f, fontSize: 9, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}>
                              {slot.include ? 'Incluir' : 'Saltar'}
                            </button>
                          </div>
                          {slot.include && (
                            <input placeholder={`Indicaciones para slide ${i + 1}…`} value={slot.note}
                              onChange={e => setReqSlots(s => s.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', background: 'var(--bg-1)', fontFamily: f, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Own photos */}
                <div style={{ marginBottom: 18 }}>
                  <label style={labelSm}>Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                  <MediaPicker selected={reqMedia} onChange={setReqMedia} max={maxImages} />
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 24 }}>
                  <label style={labelSm}>Notas para el equipo</label>
                  <textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Estilo, mensaje, tono, variaciones…" rows={3} style={{ ...inputSt, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 1 }}>
                  <button type="button" onClick={() => setShowRequest(false)} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={handleRequest} disabled={requesting} style={{ flex: 2, padding: 12, border: 'none', background: '#111827', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: requesting ? 0.5 : 1 }}>
                    {requesting ? 'Enviando…' : 'Pedir esta pieza →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Guardar referencia
         ══════════════════════════════════════════════════════════════════════ */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Guardar referencia</h2>
              <button type="button" onClick={() => { setShowAdd(false); resetAdd(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={20} /></button>
            </div>

            {addSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ En preparación</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en tu solicitud.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>1. ¿Qué formato quieres?</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([{ v: 'image', l: 'Imagen' }, { v: 'carousel', l: 'Carrusel' }, { v: 'reel', l: 'Reel', locked: !allowsVideo }] as { v: 'image'|'reel'|'carousel'; l: string; locked?: boolean }[]).map(({ v, l, locked }) => (
                      <button key={v} type="button" disabled={locked} onClick={() => setAddFormat(v)}
                        style={{ padding: '10px 16px', border: `1px solid ${addFormat === v ? '#0D9488' : 'var(--border)'}`, background: addFormat === v ? '#0D9488' : 'var(--bg)', color: addFormat === v ? '#fff' : locked ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1 }}>
                        {l}{locked ? ' 🔒' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>2. Referencia — URL o imagen</label>
                  <div style={{ display: 'flex', border: '1px solid var(--border)', marginBottom: 10 }}>
                    {(['url', 'upload'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setAddSource(s)}
                        style={{ flex: 1, padding: 8, border: 'none', cursor: 'pointer', background: addSource === s ? '#111827' : 'var(--bg)', color: addSource === s ? '#fff' : 'var(--text-tertiary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {s === 'url' ? 'Pegar URL' : 'Subir imagen'}
                      </button>
                    ))}
                  </div>
                  {addSource === 'url'
                    ? <input key="url" value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://instagram.com/p/…" style={inputSt} />
                    : <input key="file" ref={fileRef} type="file" accept="image/*,video/*" onChange={e => setAddFile(e.target.files?.[0] ?? null)} style={inputSt} />
                  }
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>3. Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                  <MediaPicker selected={addOwnMedia} onChange={setAddOwnMedia} max={maxImages} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>4. ¿Cuántas {addFormat === 'reel' ? 'piezas' : 'fotos'}?</label>
                  {addFormat === 'reel' ? (
                    <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>1 reel</p>
                  ) : (
                    <div style={{ display: 'flex' }}>
                      {Array.from({ length: Math.min(maxImages, 10) }, (_, i) => i + 1).map((n, i, arr) => (
                        <button key={n} type="button" onClick={() => setAddQty(n)}
                          style={{ minWidth: 40, padding: '9px 0', border: '1px solid var(--border)', borderRight: i < arr.length - 1 ? 'none' : undefined, background: addQty === n ? '#0D9488' : 'var(--bg)', color: addQty === n ? '#fff' : 'var(--text-tertiary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelSm}>5. Descripción <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                  <textarea value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Qué quieres conseguir, tono, qué destacar…" rows={3} style={{ ...inputSt, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 1 }}>
                  <button type="button" onClick={() => { setShowAdd(false); resetAdd(); }} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={handleAdd} disabled={addSaving} style={{ flex: 2, padding: 12, border: 'none', background: '#111827', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: addSaving ? 0.5 : 1 }}>
                    {addSaving ? 'Enviando…' : 'Enviar solicitud →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Viewer (full-size preview for image / carousel / video)
         ══════════════════════════════════════════════════════════════════════ */}
      {viewerOpen && viewerItem && (() => {
        const slides = viewerItem.media_urls.length > 0
          ? viewerItem.media_urls
          : viewerItem.thumbnail_url ? [viewerItem.thumbnail_url] : [];
        const totalSlides = slides.length;
        const currentUrl  = slides[viewerSlide] ?? viewerItem.thumbnail_url ?? '';
        const isVideo     = viewerItem.media_type === 'video';
        const isCarousel  = viewerItem.media_type === 'carousel' && totalSlides > 1;

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1050,
            display: 'flex', flexDirection: 'column', padding: 0,
          }}>
            {/* ── Top bar ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', color: '#fff',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <p style={{ fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  {viewerItem.category}
                  {isCarousel && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {viewerSlide + 1}/{totalSlides}</span>}
                  {isVideo && <span style={{ marginLeft: 8, opacity: 0.7 }}>· Vídeo</span>}
                </p>
                {viewerItem.tags.length > 0 && (
                  <p style={{ fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                    {viewerItem.tags.slice(0, 5).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 6 }}
              >
                <X size={22} />
              </button>
            </div>

            {/* ── Media area ── */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', padding: '0 12px', overflow: 'hidden',
            }}>
              {/* Prev/next for carousels */}
              {isCarousel && viewerSlide > 0 && (
                <button
                  type="button"
                  onClick={() => setViewerSlide(s => Math.max(0, s - 1))}
                  style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, borderRadius: 99,
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 2,
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {isCarousel && viewerSlide < totalSlides - 1 && (
                <button
                  type="button"
                  onClick={() => setViewerSlide(s => Math.min(totalSlides - 1, s + 1))}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, borderRadius: 99,
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 2,
                  }}
                >
                  <ChevronRight size={24} />
                </button>
              )}

              {/* Media */}
              {isVideo ? (
                <video
                  src={viewerItem.media_urls[0]}
                  poster={viewerItem.thumbnail_url ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', background: '#000' }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUrl}
                  alt={viewerItem.mood ?? viewerItem.category}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                />
              )}
            </div>

            {/* ── Slide dots (only for carousels) ── */}
            {isCarousel && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0',
              }}>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewerSlide(i)}
                    style={{
                      width: 8, height: 8, borderRadius: 99,
                      background: i === viewerSlide ? '#fff' : 'rgba(255,255,255,0.35)',
                      border: 'none', cursor: 'pointer', padding: 0,
                    }}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {/* ── Bottom actions ── */}
            <div style={{
              display: 'flex', gap: 1, padding: '0 18px 18px',
            }}>
              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                style={{
                  flex: 1, padding: 14,
                  background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
                  fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => { setViewerOpen(false); openRemix(viewerItem); }}
                style={{
                  flex: 2, padding: 14,
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontFamily: fc, fontSize: 13, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Sparkles size={16} /> Remezclar
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Remezclar desde banco
         ══════════════════════════════════════════════════════════════════════ */}
      {remixOpen && remixItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Remezclar referencia
              </h2>
              <button type="button" onClick={() => setRemixOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Reference preview */}
            {(remixItem.thumbnail_url || remixItem.media_urls[0]) && (
              <div style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={remixItem.thumbnail_url ?? remixItem.media_urls[0]}
                  alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block', border: '1px solid var(--border)' }} />
                <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {remixItem.category} · {remixItem.tags.slice(0, 4).join(' · ')}
                </p>
              </div>
            )}

            {remixResult ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={remixResult.imageUrl} alt="Generada"
                    style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block', border: '1px solid var(--accent)' }} />
                </div>
                <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Imagen generada. {remixResult.postId
                    ? 'La tienes guardada como post pendiente.'
                    : 'No se pudo guardar el post — la imagen sigue disponible arriba.'}
                </p>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button type="button" onClick={() => { setRemixResult(null); setRemixPrompt(''); }}
                    style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Generar otra
                  </button>
                  <button type="button" onClick={() => setRemixOpen(false)}
                    style={{ flex: 1, padding: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Format */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Formato
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['image', 'carousel', 'reel'] as const).map(fmt => {
                      const active = remixFormat === fmt;
                      return (
                        <button key={fmt} type="button" onClick={() => setRemixFormat(fmt)}
                          style={{ padding: '8px 14px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--bg)', color: active ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {FORMAT_LABEL[fmt]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Qué quieres generar
                  </label>
                  <textarea
                    value={remixPrompt}
                    onChange={e => setRemixPrompt(e.target.value)}
                    placeholder="Ej: Mismo estilo pero con mi producto en primer plano, tono más cálido…"
                    rows={4}
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    La referencia se usa como guía de estilo — tu descripción manda sobre el contenido.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 1 }}>
                  <button type="button" onClick={() => setRemixOpen(false)}
                    style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={submitRemix} disabled={remixRunning}
                    style={{ flex: 2, padding: 12, border: 'none', background: '#111827', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: remixRunning ? 0.5 : 1 }}>
                    {remixRunning ? 'Generando…' : 'Generar →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
