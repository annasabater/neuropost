'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  /inspiracion — single unified page (no top-level tabs)
//
//  Mental model: client sees ONE stream of "things to request".
//  Origin (editorial / user_saved / ai_generated) is a FILTER, not a section.
//  The only two actions are:  ❤️ favorite  |  "Pedir esta pieza →"
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Plus, X, Search, ChevronLeft, ChevronRight, Sparkles, FolderPlus, Pencil, Trash2, FolderOpen, MoreHorizontal, Check, Heart, Bookmark, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import { createBrowserClient } from '@/lib/supabase';
import { SEASON_CHIPS, FORMAT_CHIPS } from '@/components/inspiration/TagChipsBar';
import { InspirationCard, type InspirationItem } from '@/components/inspiration/InspirationCard';
import { SavePopover, type Collection } from '@/components/inspiration/SavePopover';
import { Skeleton } from '@/components/ui/Skeleton';

// All known tags for smart search matching
const ALL_TAGS = [...SEASON_CHIPS, ...FORMAT_CHIPS];

// Normalize text for fuzzy matching (remove accents, lowercase)
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
  return d[m][n];
}

// Returns closest vocab word within maxDist, or null
function fuzzyCorrect(query: string, vocab: string[], maxDist: number): string | null {
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const word of vocab) {
    if (Math.abs(word.length - query.length) > maxDist) continue;
    const d = levenshtein(query, word);
    if (d < bestDist) { bestDist = d; best = word; }
  }
  return bestDist <= maxDist ? best : null;
}

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Format helpers ───────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  all: 'Todos', image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo',
};

// ─── Scope pills ──────────────────────────────────────────────────────────────

type Scope = 'all' | 'favorites' | 'guardadas' | 'sugerencias' | 'solicitudes';

const SCOPE_PILLS: { key: Scope; label: string }[] = [
  { key: 'all',          label: 'Todo' },
  { key: 'sugerencias',  label: 'Sugerencias' },
  { key: 'guardadas',    label: 'Guardadas' },
  { key: 'solicitudes',  label: 'Solicitudes' },
  { key: 'favorites',    label: 'Favoritos' },
];

// ─── Request types ────────────────────────────────────────────────────────────

type TimingPref = 'asap' | 'next_two_weeks' | 'specific_date';

interface ReferenceRequest {
  id:               string;
  source:           'bank' | 'legacy';
  item_id:          string;
  status:           'pending' | 'in_progress' | 'scheduled' | 'published' | 'cancelled';
  client_comment:   string | null;
  timing_preference: TimingPref | null;
  preferred_date:   string | null;
  created_at:       string;
  scheduled_for:    string | null;
  published_at:     string | null;
  cancelled_at:     string | null;
  thumbnail_url:    string | null;
  item_label:       string | null;
}

const BADGES_BY_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Pendiente',     bg: '#fef3c7', color: '#78350f' },
  in_progress: { label: 'En proceso',    bg: '#dbeafe', color: '#1e3a8a' },
  scheduled:   { label: 'En calendario', bg: '#f0fdfa', color: '#0F766E' },
  published:   { label: '✓ Publicada',   bg: '#d1fae5', color: '#065f46' },
  cancelled:   { label: 'Cancelada',     bg: '#f3f4f6', color: '#6b7280' },
};

const TIMING_LABELS: Record<string, string> = {
  asap:           'Sin prisa',
  next_two_weeks: 'Próximas 2 semanas',
  specific_date:  'Fecha concreta',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InspiracionPage() {
  const brand      = useAppStore(s => s.brand);
  const planLimits = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowsVideo = planLimits.videosPerWeek > 0;
  const maxImages  = planLimits.carouselMaxPhotos;

  // ── Info popover ──────────────────────────────────────────────────────────
  const [infoOpen, setInfoOpen] = useState(false);

  // ── Solicitudes state ──────────────────────────────────────────────────────
  const [requests,        setRequests]        = useState<ReferenceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [statusFilter,    setStatusFilter]    = useState<string>('all');
  const [requestModal,    setRequestModal]    = useState<InspirationItem | null>(null);
  const [reqComment,      setReqComment]      = useState('');
  const [reqTiming,       setReqTiming]       = useState<TimingPref>('next_two_weeks');
  const [reqDate,         setReqDate]         = useState('');
  const [reqSubmitting,   setReqSubmitting]   = useState(false);

  function openRequestModal(item: InspirationItem) {
    setRequestModal(item);
    setReqComment('');
    setReqTiming('next_two_weeks');
    setReqDate('');
  }

  async function handleSubmitRequest() {
    if (!requestModal) return;
    setReqSubmitting(true);
    try {
      const res = await fetch('/api/inspiracion/request-recreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source:             requestModal.source ?? 'legacy',
          item_id:            requestModal.id,
          client_comment:     reqComment.trim() || null,
          timing_preference:  reqTiming,
          preferred_date:     reqTiming === 'specific_date' ? (reqDate || null) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return; }
      toast.success('Solicitud enviada — el equipo la verá en breve');
      setRequestModal(null);
      // Mark item as having active request
      setItems(prev => prev.map(i => i.id === requestModal.id ? { ...i, has_active_request: true } : i));
      loadRequests();
    } catch { toast.error('Error al enviar la solicitud'); }
    finally { setReqSubmitting(false); }
  }

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/inspiracion/requests');
      if (res.ok) { const json = await res.json(); setRequests(json.requests ?? []); }
    } catch { /* silent */ }
    finally { setRequestsLoading(false); }
  }, []);

  async function handleCancelRequest(id: string) {
    try {
      const res = await fetch(`/api/inspiracion/requests/${id}/cancel`, { method: 'POST' });
      if (!res.ok) { toast.error('No se pudo cancelar'); return; }
      toast.success('Solicitud cancelada');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r));
    } catch { toast.error('Error'); }
  }

  // ── Library state ──────────────────────────────────────────────────────────
  const [items,    setItems]    = useState<InspirationItem[]>([]);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [scope,    setScope]    = useState<Scope>('all');
  const [search,   setSearch]   = useState('');
  const [mediaFmt, setMediaFmt] = useState('');   // '' | 'image' | 'carousel' | 'video'
  const [tags,     setTags]     = useState<string[]>([]);

  // ── Fullscreen viewer state (image/carousel/video for bank items) ─────────
  const [viewerOpen,  setViewerOpen]  = useState(false);
  const [viewerItem,  setViewerItem]  = useState<InspirationItem | null>(null);
  const [viewerSlide, setViewerSlide] = useState(0);

  function openViewer(item: InspirationItem) {
    setViewerItem(item);
    setViewerSlide(0);
    setViewerOpen(true);
  }

  // ── Remix modal state (only bank items can be remixed) ────────────────────
  const [remixOpen,      setRemixOpen]      = useState(false);
  const [remixItem,      setRemixItem]      = useState<InspirationItem | null>(null);
  const [remixPrompt,    setRemixPrompt]    = useState('');
  const [remixFormat,    setRemixFormat]    = useState<'image' | 'carousel' | 'reel'>('image');
  const [remixRunning,   setRemixRunning]   = useState(false);
  const [remixResult,    setRemixResult]    = useState<{ imageUrl: string; postId: string | null } | null>(null);

  function openRemix(item: InspirationItem) {
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

  // ── Save popover state (from card's Bookmark click) ──────────────────────
  const [saveAnchor, setSaveAnchor] = useState<DOMRect | null>(null);
  const [saveItem,   setSaveItem]   = useState<InspirationItem | null>(null);

  // ── Collections (for Guardadas tab + SavePopover dropdown) ───────────────
  const [collections,    setCollections]    = useState<Collection[]>([]);
  const [unfiledCount,   setUnfiledCount]   = useState(0);
  const [totalSavedCount, setTotalSavedCount] = useState(0);
  const [activeCollection, setActiveCollection] = useState<string>('all'); // 'all' | 'unfiled' | uuid

  const loadCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/inspiracion/collections');
      if (!res.ok) return;
      const json = await res.json() as {
        collections: Collection[]; unfiled_count: number; total_count: number;
      };
      setCollections(json.collections ?? []);
      setUnfiledCount(json.unfiled_count ?? 0);
      setTotalSavedCount(json.total_count ?? 0);
    } catch { /* silent */ }
  }, []);

  // ── Tag vocabulary for fuzzy search ───────────────────────────────────────
  const [tagVocab, setTagVocab] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/inspiracion/tags-vocab')
      .then(r => r.ok ? r.json() : { tags: [] })
      .then(d => setTagVocab(d.tags ?? []))
      .catch(() => {});
  }, []);

  // ── Search debounce ref ────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (opts?: {
    scope?: Scope; search?: string; mediaFmt?: string;
    tags?: string[]; page?: number; collection?: string;
  }) => {
    setLoading(true);
    const p = new URLSearchParams();
    const s  = opts?.scope    ?? scope;
    const q  = opts?.search   !== undefined ? opts.search   : search;
    const mf = opts?.mediaFmt !== undefined ? opts.mediaFmt : mediaFmt;
    const tg = opts?.tags     !== undefined ? opts.tags     : tags;
    const pg = opts?.page     ?? 1;
    const co = opts?.collection ?? (s === 'guardadas' ? activeCollection : undefined);

    p.set('scope', s);
    p.set('page',  String(pg));
    if (mf)           p.set('media_type', mf);
    if (q.trim())     p.set('search', q.trim());
    if (tg.length > 0) p.set('tags', tg.join(','));
    if (co)           p.set('collection', co);

    try {
      const res  = await fetch(`/api/inspiracion/list?${p}`);
      const json = await res.json() as { items: InspirationItem[]; total: number; pages: number };
      if (res.ok) { setItems(json.items ?? []); setPages(json.pages ?? 1); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [scope, search, mediaFmt, tags, activeCollection]);

  useEffect(() => { fetchItems(); loadCollections(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: G = open "Guardar referencia" modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShowAdd(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reload the grid whenever the user changes collection (Guardadas tab)
  useEffect(() => {
    if (scope === 'guardadas') fetchItems({ collection: activeCollection });
    if (scope === 'solicitudes') loadRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection, scope]);

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
        (payload: { new: {
          id: string;
          status: string;
          generated_images?: string[];
          generation_history?: { prediction_id: string; images: string[]; generated_at: string; version: number }[];
        } }) => {
          const u = payload.new;
          const patch = (list: InspirationItem[]) =>
            list.map(i => i.recreation?.id === u.id
              ? { ...i, recreation: {
                  ...i.recreation!,
                  status:             u.status,
                  generated_images:   u.generated_images ?? [],
                  generation_history: u.generation_history ?? i.recreation?.generation_history ?? [],
                } }
              : i);
          setItems(patch);
          if (u.status === 'revisar') toast.success('¡Tu recreación está lista para revisar!');
          if (u.status === 'failed')  toast.error('Tu recreación no se pudo completar.');
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

  // ── Favorite toggle (unified — works for legacy + bank items) ─────────────
  async function handleFavorite(id: string, val: boolean, item: InspirationItem) {
    const source = item.source ?? 'legacy';
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: val } : i));
    try {
      const res = await fetch('/api/inspiracion/favorite', {
        method: val ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, item_id: id }),
      });
      if (!res.ok) throw new Error('Favorite failed');
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: !val } : i));
      toast.error('Error al actualizar');
    }
  }

  // ── Save popover callbacks ────────────────────────────────────────────────
  function openSavePopover(item: InspirationItem, anchor: DOMRect) {
    setSaveItem(item);
    setSaveAnchor(anchor);
  }
  function closeSavePopover() {
    setSaveItem(null);
    setSaveAnchor(null);
  }
  function handleSavedChange(itemId: string, isSaved: boolean, collectionIds: string[]) {
    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, is_saved: isSaved, saved_collection_ids: collectionIds }
      : i));
    loadCollections(); // refresh counts
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
  const [showAdd,    setShowAdd]    = useState(false);
  const [addSource,  setAddSource]  = useState<'url' | 'upload'>('url');
  const [addUrl,     setAddUrl]     = useState('');
  const [addFile,    setAddFile]    = useState<File | null>(null);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addResult,  setAddResult]  = useState<{ category: string; tags: string[]; mood: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number>(0);

  // ── Collection management state ───────────────────────────────────────────
  const [deleteDialog,  setDeleteDialog]  = useState<{ id: string; name: string; count: number } | null>(null);
  const [deletingColl,  setDeletingColl]  = useState(false);
  const [renameId,      setRenameId]      = useState<string | null>(null);
  const [renameValue,   setRenameValue]   = useState('');
  const [selectMode,    setSelectMode]    = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [uncollecting,  setUncollecting]  = useState(false);
  const [collMenuOpen,  setCollMenuOpen]  = useState(false);
  const collMenuRef = useRef<HTMLDivElement>(null);
  const [fmtMenuOpen,   setFmtMenuOpen]   = useState(false);
  const fmtMenuRef = useRef<HTMLDivElement>(null);

  // Close collection menu on outside click
  useEffect(() => {
    if (!collMenuOpen) return;
    function handle(e: MouseEvent) {
      if (collMenuRef.current && !collMenuRef.current.contains(e.target as Node)) setCollMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [collMenuOpen]);

  // Close format menu on outside click
  useEffect(() => {
    if (!fmtMenuOpen) return;
    function handle(e: MouseEvent) {
      if (fmtMenuRef.current && !fmtMenuRef.current.contains(e.target as Node)) setFmtMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [fmtMenuOpen]);

  function resetAdd() { setAddSource('url'); setAddUrl(''); setAddFile(null); setAddResult(null); }

  function toggleSelectItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function uncollectSelected() {
    if (!selectedIds.size || !activeCollection || activeCollection === 'all' || activeCollection === 'unfiled') return;
    setUncollecting(true);
    try {
      await Promise.all([...selectedIds].map(itemId => {
        const item = items.find(i => i.id === itemId);
        if (!item) return Promise.resolve();
        const src = item.source ?? 'legacy';
        return fetch('/api/inspiracion/save', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src, item_id: itemId, collection_id: activeCollection }),
        }).then(() => fetch('/api/inspiracion/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src, item_id: itemId, collection_id: null }),
        }));
      }));
      toast.success(`${selectedIds.size} referencia${selectedIds.size > 1 ? 's sacadas' : ' sacada'} de la colección`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await loadCollections();
      fetchItems({ collection: activeCollection });
    } catch { toast.error('Error al sacar referencias'); }
    finally { setUncollecting(false); }
  }

  async function confirmDeleteCollection(mode: 'keep' | 'remove_items') {
    if (!deleteDialog) return;
    setDeletingColl(true);
    try {
      const res = await fetch(`/api/inspiracion/collections?id=${deleteDialog.id}&mode=${mode}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Error al eliminar'); return; }
      toast.success('Colección eliminada');
      setDeleteDialog(null);
      if (activeCollection === deleteDialog.id) setActiveCollection('all');
      await loadCollections();
      if (scope === 'guardadas') fetchItems({ collection: 'all' });
    } catch { toast.error('Error'); }
    finally { setDeletingColl(false); }
  }

  async function submitRename() {
    if (!renameId || !renameValue.trim()) return;
    const next = renameValue.trim();
    try {
      const res = await fetch('/api/inspiracion/collections', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renameId, name: next }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Error'); return; }
      toast.success('Renombrada');
      setRenameId(null);
      await loadCollections();
    } catch { toast.error('Error'); }
  }

  async function handleAdd() {
    const hasRef = (addSource === 'url' && addUrl.trim()) || (addSource === 'upload' && !!addFile);
    if (!hasRef) { toast.error('Pega una URL o sube un archivo'); return; }
    setAddSaving(true);
    try {
      let res: Response;
      if (addSource === 'upload' && addFile) {
        const fd = new FormData(); fd.append('file', addFile);
        res = await fetch('/api/inspiracion/contribuir', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/inspiracion/contribuir', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: addUrl.trim() }),
        });
      }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error al procesar'); return; }
      setShowAdd(false);
      resetAdd();
      loadCollections();
      fetchItems();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95 }}>
            Inspiración
          </h1>
          {/* ⓘ info toggle */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setInfoOpen(o => !o)}
              title="Cómo funciona"
              style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${infoOpen ? '#0F766E' : 'var(--border)'}`, background: infoOpen ? '#f0fdfa' : 'transparent', color: infoOpen ? '#0F766E' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 13, fontWeight: 700, flexShrink: 0, transition: 'all 0.12s' }}
            >
              i
            </button>
            {infoOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 200, background: 'var(--bg)', border: '1px solid #0F766E', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '16px 18px', width: 320, lineHeight: 1.6 }}>
                <div style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, color: '#111827', marginBottom: 8, letterSpacing: '0.01em', textTransform: 'uppercase' }}>
                  Cómo funciona
                </div>
                <div style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>
                  <strong>1.</strong> Guarda lo que te inspire — es tu biblioteca personal.<br />
                  <strong>2.</strong> Cuando veas algo que quieras en tu cuenta, pulsa <em>Enviar solicitud</em>.<br />
                  <strong>3.</strong> Lo recreamos con tu marca y lo añadimos a tu calendario.
                </div>
                <button type="button" onClick={() => setInfoOpen(false)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inspi-header-cta"
          title="Guardar nueva referencia"
          style={{ background: '#0D9488', color: '#fff', border: 'none', padding: '12px 28px', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: '0 2px 12px rgba(13,148,136,0.35)' }}
        >
          <Plus size={15} />
          <span className="inspi-cta-label">Guardar referencia</span>
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
              </button>
            );
          })}
        </div>

        {/* Search + Format — right side */}
        <div className="inspi-search-format" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
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
                  if (norm.length < 2) { setFilter({ search: '', tags: [], mediaFmt: '' }); return; }

                  // 0. Format keyword shortcut: typing "imagen/foto" or "video/reel" filters by format
                  const FMT_KEYWORDS: Record<string, string> = {
                    imagen: 'image', foto: 'image', image: 'image',
                    video: 'video', reel: 'video', reels: 'video',
                  };
                  if (FMT_KEYWORDS[norm]) {
                    setSearch('');
                    setFilter({ mediaFmt: FMT_KEYWORDS[norm], search: '', tags: [] });
                    return;
                  }

                  // 1. Exact substring match against predefined tags
                  const matched = ALL_TAGS.filter(t =>
                    normalize(t.label).includes(norm) || normalize(t.key).includes(norm)
                  ).map(t => t.key);

                  if (matched.length > 0) {
                    setFilter({ tags: matched, search: '', mediaFmt: '' });
                    return;
                  }

                  // 2. Fuzzy correction against live DB vocab (typos like cage→cafe)
                  const maxDist = norm.length <= 4 ? 1 : 2;
                  const allVocab = [
                    ...ALL_TAGS.map(t => normalize(t.label)),
                    ...ALL_TAGS.map(t => normalize(t.key)),
                    ...tagVocab,
                  ];
                  const corrected = fuzzyCorrect(norm, allVocab, maxDist);
                  setFilter({ search: corrected ?? v.trim(), tags: [], mediaFmt: '' });
                }, 350);
              }}
              style={{ padding: '6px 26px 6px 26px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, outline: 'none', width: 160, boxSizing: 'border-box', borderRadius: 99 }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setFilter({ search: '', tags: [], mediaFmt: '' }); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Format — ⋯ dropdown */}
          <div ref={fmtMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setFmtMenuOpen(o => !o)}
              title="Filtrar por formato"
              style={{
                padding: '5px 8px', border: `1px solid ${mediaFmt ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 99, background: mediaFmt ? 'var(--accent-soft)' : fmtMenuOpen ? 'var(--bg-1)' : 'transparent',
                color: mediaFmt ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: f, fontSize: 11, fontWeight: mediaFmt ? 700 : 400,
              }}
            >
              {mediaFmt ? FORMAT_LABEL[mediaFmt] : <MoreHorizontal size={15} />}
            </button>

            {fmtMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 120,
                background: 'var(--bg)', border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 130, padding: '4px 0',
              }}>
                {([['', 'Todos'], ['image', 'Imagen'], ['video', 'Vídeo']] as const).map(([fmt, label]) => (
                  <button key={fmt || 'all'} type="button"
                    onClick={() => { setFilter({ mediaFmt: fmt }); setFmtMenuOpen(false); }}
                    style={{
                      width: '100%', padding: '9px 14px', border: 'none',
                      background: mediaFmt === fmt ? 'var(--accent-soft)' : 'transparent',
                      color: mediaFmt === fmt ? 'var(--accent)' : 'var(--text-primary)',
                      fontFamily: f, fontSize: 13, fontWeight: mediaFmt === fmt ? 600 : 400,
                      textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    {label}
                    {mediaFmt === fmt && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Collections bar (only on Guardadas tab) ── */}
      {scope === 'guardadas' && (() => {
        const activeColl = collections.find(c => c.id === activeCollection) ?? null;
        return (
          <div className="insp-coll-bar" style={{ marginTop: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* System pills */}
            {([
              { id: 'all', label: 'Todas', count: totalSavedCount, always: true },
            ] as { id: string; label: string; count: number; always: boolean }[]).filter(c => c.always || c.count > 0).map(c => {
              const active = activeCollection === c.id;
              return (
                <button key={c.id} type="button"
                  onClick={() => { setActiveCollection(c.id); setSelectMode(false); setSelectedIds(new Set()); }}
                  style={{ padding: '5px 12px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 99, background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.12s' }}>
                  {c.id === 'all' ? <FolderOpen size={12} /> : null}
                  {c.label} <span style={{ opacity: 0.75, fontWeight: 400 }}>({c.count})</span>
                </button>
              );
            })}

            {/* User collection pills */}
            {collections.map(c => {
              const active = activeCollection === c.id;
              return (
                <button key={c.id} type="button"
                  onClick={() => { setActiveCollection(c.id); setSelectMode(false); setSelectedIds(new Set()); }}
                  style={{ padding: '5px 14px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 99, background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.12s' }}>
                  {c.name} <span style={{ opacity: 0.75, fontWeight: 400 }}>({c.item_count ?? 0})</span>
                </button>
              );
            })}

            {/* Rename inline form — shown when editing */}
            {renameId === activeCollection && activeColl && (
              <form onSubmit={e => { e.preventDefault(); submitRename(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  style={{ padding: '4px 8px', border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, outline: 'none', width: 120 }} />
                <button type="submit" style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', fontFamily: f, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>OK</button>
                <button type="button" onClick={() => setRenameId(null)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-tertiary)', fontFamily: f, fontSize: 11, cursor: 'pointer' }}>✕</button>
              </form>
            )}

            {/* ⋯ menu — always visible on Guardadas tab */}
            <div ref={collMenuRef} style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
              <button type="button"
                onClick={() => setCollMenuOpen(o => !o)}
                title="Opciones de colección"
                style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 99, background: collMenuOpen ? 'var(--bg-1)' : 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                <MoreHorizontal size={15} />
              </button>

              {collMenuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 120, background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 200, padding: '4px 0' }}>
                  {/* Crear colección — siempre primero */}
                  <button type="button"
                    onClick={async () => {
                      setCollMenuOpen(false);
                      const name = window.prompt('Nombre de la nueva colección')?.trim();
                      if (!name) return;
                      try {
                        const res = await fetch('/api/inspiracion/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
                        const json = await res.json();
                        if (!res.ok) { toast.error(json.error ?? 'Error'); return; }
                        toast.success('Colección creada');
                        await loadCollections();
                        setActiveCollection(json.collection.id);
                      } catch { toast.error('Error'); }
                    }}
                    style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FolderPlus size={13} color="var(--text-tertiary)" /> Crear colección
                  </button>

                  {/* Opciones de la colección activa */}
                  {activeColl && (
                    <>
                      <div style={{ margin: '4px 0', borderTop: '1px solid var(--border)' }} />
                      <button type="button"
                        onClick={() => { setCollMenuOpen(false); setSelectMode(s => !s); setSelectedIds(new Set()); }}
                        style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 13, height: 13, border: '1.5px solid var(--text-tertiary)', borderRadius: 99, display: 'inline-block', flexShrink: 0 }} />
                        {selectMode ? 'Cancelar selección' : 'Seleccionar'}
                      </button>
                      <button type="button"
                        onClick={() => { setCollMenuOpen(false); setRenameId(activeCollection); setRenameValue(activeColl.name); }}
                        style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Pencil size={13} color="var(--text-tertiary)" /> Editar colección
                      </button>
                      <div style={{ margin: '4px 0', borderTop: '1px solid var(--border)' }} />
                      <button type="button"
                        onClick={() => { setCollMenuOpen(false); setDeleteDialog({ id: activeColl.id, name: activeColl.name, count: activeColl.item_count ?? 0 }); }}
                        style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'transparent', color: '#b91c1c', fontFamily: f, fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Trash2 size={13} /> Eliminar colección
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {scope !== 'guardadas' && <div style={{ marginTop: 14, marginBottom: 10 }} />}

      {/* ── Solicitudes tab ────────────────────────────────────────────────── */}
      {scope === 'solicitudes' && (() => {
        const filtered = statusFilter === 'all'
          ? requests
          : requests.filter(r => r.status === statusFilter);
        const countFor = (s: string) => s === 'all' ? requests.length : requests.filter(r => r.status === s).length;

        return (
          <div style={{ marginTop: 20 }}>
            {/* Status sub-tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {(['all','pending','in_progress','scheduled','published','cancelled'] as const).map(s => {
                const labels: Record<string, string> = { all: 'Todas', pending: 'Pendientes', in_progress: 'En proceso', scheduled: 'En calendario', published: 'Publicadas', cancelled: 'Canceladas' };
                const active = statusFilter === s;
                const n = countFor(s);
                if (s !== 'all' && n === 0) return null;
                return (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, background: active ? '#111827' : 'var(--bg)', color: active ? '#fff' : 'var(--text-tertiary)', border: `1px solid ${active ? '#111827' : 'var(--border)'}`, cursor: 'pointer', fontFamily: f }}>
                    {labels[s]} <span style={{ opacity: 0.6, marginLeft: 4 }}>({n})</span>
                  </button>
                );
              })}
            </div>

            {requestsLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin solicitudes</p>
                <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 360, margin: '0 auto 20px' }}>
                  Cuando guardes algo y quieras que lo recreemos, pulsa <strong>Enviar solicitud</strong> en la card.
                </p>
                <button type="button" onClick={() => setFilter({ scope: 'guardadas' })} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '10px 22px', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer' }}>
                  Ver Guardadas
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(req => {
                  const badge = BADGES_BY_STATUS[req.status] ?? BADGES_BY_STATUS.pending;
                  return (
                    <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 14, padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', alignItems: 'start' }}>
                      {/* Thumbnail */}
                      {req.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={req.thumbnail_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: 80, height: 80, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FolderOpen size={24} color="var(--text-tertiary)" />
                        </div>
                      )}

                      {/* Content */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ padding: '3px 8px', background: badge.bg, color: badge.color, fontFamily: f, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {badge.label}
                          </span>
                          <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Enviada {fmtDate(req.created_at)}
                          </span>
                        </div>
                        {req.item_label && (
                          <p style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{req.item_label}</p>
                        )}
                        {req.client_comment && (
                          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>"{req.client_comment}"</p>
                        )}
                        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                          {TIMING_LABELS[req.timing_preference ?? 'next_two_weeks']}
                          {req.preferred_date && ` · ${fmtDate(req.preferred_date)}`}
                        </p>
                        {req.status === 'scheduled' && req.scheduled_for && (
                          <p style={{ fontFamily: f, fontSize: 12, color: '#0F766E', fontWeight: 600, margin: 0 }}>
                            Programada para {fmtDate(req.scheduled_for)}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div>
                        {req.status === 'pending' && (
                          <button type="button" onClick={() => handleCancelRequest(req.id)}
                            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: f }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Results (grid — all scopes except solicitudes) ──────────────────── */}
      <div id="inspi-results" style={{ marginTop: 16, display: scope === 'solicitudes' ? 'none' : undefined }}>
        {loading && items.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: '4/5', overflow: 'hidden' }}>
                <Skeleton width="100%" height="100%" borderRadius="0" />
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div style={{ padding: '100px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
              {scope === 'favorites'   ? 'Sin favoritos aún' :
               scope === 'guardadas' && activeCollection !== 'all' ? 'Esta colección está vacía' :
               scope === 'guardadas'   ? 'Nada guardado todavía' :
               scope === 'sugerencias' ? 'Sin sugerencias para tu sector' :
               'Todavía no hay nada aquí'}
            </p>
            <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 360, margin: '0 auto 24px' }}>
              {scope === 'favorites'
                ? 'Pulsa ❤️ en cualquier imagen para añadirla.'
                : scope === 'guardadas' && activeCollection !== 'all'
                ? 'Guarda referencias desde el feed y asígnalas a esta colección con 🔖.'
                : scope === 'guardadas'
                ? 'Pulsa 🔖 en cualquier imagen para guardarla en tu biblioteca.'
                : scope === 'sugerencias'
                ? `No hay sugerencias para ${brand?.sector ?? 'tu sector'}. Explora "Todo" mientras tanto.`
                : 'Los contenidos aparecerán a medida que se añadan referencias.'}
            </p>
            {scope === 'guardadas' && activeCollection !== 'all' && (
              <button type="button" onClick={() => setActiveCollection('all')} style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '9px 20px', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', marginRight: 8 }}>
                Ver todas las guardadas
              </button>
            )}
            {(scope === 'all' || scope === 'favorites' || (scope === 'guardadas' && activeCollection === 'all')) && (
              <button type="button" onClick={() => setShowAdd(true)} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '10px 22px', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer' }}>
                Guardar referencia
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {displayItems.map((item, idx) => (
                <div key={`${item.source ?? 'legacy'}-${item.id}-${idx}`}
                  style={{ position: 'relative' }}
                  onClick={selectMode ? () => toggleSelectItem(item.id) : undefined}>
                  {/* Selection overlay */}
                  {selectMode && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 10,
                      background: selectedIds.has(item.id) ? 'rgba(13,148,136,0.35)' : 'rgba(0,0,0,0.0)',
                      border: selectedIds.has(item.id) ? '2px solid #0D9488' : '2px solid transparent',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        width: 20, height: 20,
                        border: `2px solid ${selectedIds.has(item.id) ? '#0D9488' : 'rgba(255,255,255,0.8)'}`,
                        background: selectedIds.has(item.id) ? '#0D9488' : 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 99,
                      }}>
                        {selectedIds.has(item.id) && <X size={11} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  )}
                  <InspirationCard
                    item={item}
                    onFavorite={selectMode ? undefined : handleFavorite}
                    onSave={selectMode ? undefined : openSavePopover}
                    onRequest={selectMode ? undefined : openRequestModal}
                    onOpen={selectMode ? undefined : (item.source === 'bank' ? openViewer : undefined)}
                  />
                </div>
              ))}
            </div>

            {/* Multi-select action bar */}
            {selectMode && (
              <div style={{ position: 'sticky', bottom: 16, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--text-primary)', color: 'var(--bg)', padding: '12px 20px', marginTop: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600 }}>
                  {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    onClick={() => setSelectedIds(new Set(displayItems.map(i => i.id)))}
                    style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Seleccionar todo
                  </button>
                  <button type="button"
                    disabled={selectedIds.size === 0 || uncollecting}
                    onClick={uncollectSelected}
                    style={{ padding: '6px 16px', background: selectedIds.size === 0 ? 'rgba(255,255,255,0.2)' : '#0D9488', color: '#fff', border: 'none', fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer' }}>
                    {uncollecting ? 'Sacando…' : 'Sacar de colección'}
                  </button>
                </div>
              </div>
            )}

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

      {/* ── Save popover (rendered via portal-style fixed positioning) ─────── */}
      {saveItem && saveAnchor && (
        <SavePopover
          item={saveItem}
          anchor={saveAnchor}
          collections={collections}
          onClose={closeSavePopover}
          onCollectionsChange={(next) => setCollections(next)}
          onSavedChange={handleSavedChange}
        />
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
           MODAL: Añadir inspiración
         ══════════════════════════════════════════════════════════════════════ */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 4 }}>Añadir inspiración</h2>
              </div>
              <button type="button" onClick={() => { setShowAdd(false); resetAdd(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, flexShrink: 0 }}><X size={20} /></button>
            </div>

            {addSaving ? (
              /* ── Loading state ── */
              <div style={{ marginTop: 28, padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontFamily: fc, fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 8 }}>En breve aparecerá en Mis subidas</p>
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)' }}>La IA la está clasificando, puede tardar unos segundos</p>
              </div>
            ) : (
              /* ── Form ── */
              <>
                <div style={{ display: 'flex', border: '1px solid var(--border)', marginTop: 24, marginBottom: 12 }}>
                  {(['url', 'upload'] as const).map(s => (
                    <button key={s} type="button" onClick={() => { setAddSource(s); setAddUrl(''); setAddFile(null); }}
                      style={{ flex: 1, padding: 10, border: 'none', cursor: 'pointer', background: addSource === s ? '#111827' : 'var(--bg)', color: addSource === s ? '#fff' : 'var(--text-tertiary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {s === 'url' ? 'Pegar URL' : 'Subir archivo'}
                    </button>
                  ))}
                </div>

                {addSource === 'url' ? (
                  <input
                    key="url"
                    value={addUrl}
                    onChange={e => setAddUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                    placeholder="https://…  (imagen, vídeo, Instagram, Pinterest…)"
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
                  />
                ) : (
                  <div
                    style={{ border: '2px dashed var(--border)', padding: '28px 20px', textAlign: 'center', marginBottom: 20, cursor: 'pointer' }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <p style={{ fontFamily: f, fontSize: 13, color: addFile ? 'var(--text-primary)' : 'var(--text-tertiary)', margin: 0 }}>
                      {addFile ? addFile.name : 'Haz clic o arrastra una imagen o vídeo'}
                    </p>
                    <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
                      onChange={e => setAddFile(e.target.files?.[0] ?? null)} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 1 }}>
                  <button type="button" onClick={() => { setShowAdd(false); resetAdd(); }}
                    style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleAdd}
                    style={{ flex: 2, padding: 12, border: 'none', background: '#0D9488', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    Analizar y guardar →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Viewer — Instagram-style full-screen
         ══════════════════════════════════════════════════════════════════════ */}
      {viewerOpen && viewerItem && (() => {
        const viewerIdx = items.findIndex(i => i.id === viewerItem.id);
        const urls      = viewerItem.media_urls ?? [];
        const slides    = urls.length > 0 ? urls : viewerItem.thumbnail_url ? [viewerItem.thumbnail_url] : [];
        const totalSlides = slides.length;
        const currentUrl  = slides[viewerSlide] ?? viewerItem.thumbnail_url ?? '';
        const isVideo     = viewerItem.media_type === 'video';
        const isCarousel  = viewerItem.media_type === 'carousel' && totalSlides > 1;

        function goNext() {
          if (viewerIdx < items.length - 1) {
            setViewerItem(items[viewerIdx + 1]);
            setViewerSlide(0);
          } else {
            setViewerOpen(false);
          }
        }
        function goPrev() {
          if (viewerIdx > 0) {
            setViewerItem(items[viewerIdx - 1]);
            setViewerSlide(0);
          }
        }

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1050, outline: 'none' }}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape')                          setViewerOpen(false);
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goNext();
              if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  goPrev();
            }}
            onWheel={(e) => { if (e.deltaY > 0) goNext(); else goPrev(); }}
            onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              const dy = e.changedTouches[0].clientY - touchStartY.current;
              if (dy > 60)  goNext();
              if (dy < -60) goPrev();
            }}
          >
            {/* Close — subtle top-left X */}
            <button
              type="button"
              onClick={() => setViewerOpen(false)}
              style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 99 }}
            >
              <X size={20} />
            </button>

            {/* Carousel slide counter */}
            {isCarousel && (
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, color: '#fff', fontFamily: f, fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.45)', padding: '3px 10px', borderRadius: 99 }}>
                {viewerSlide + 1} / {totalSlides}
              </div>
            )}

            {/* Full-screen media */}
            <div
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setViewerOpen(false)}
            >
              {isVideo ? (
                <video
                  src={(viewerItem.media_urls ?? [])[0]}
                  poster={viewerItem.thumbnail_url ?? undefined}
                  controls autoPlay playsInline
                  style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUrl}
                  alt={viewerItem.mood ?? viewerItem.category ?? ''}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>

            {/* Carousel prev/next */}
            {isCarousel && viewerSlide > 0 && (
              <button type="button" onClick={() => setViewerSlide(s => s - 1)}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: 99, background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronLeft size={22} />
              </button>
            )}
            {isCarousel && viewerSlide < totalSlides - 1 && (
              <button type="button" onClick={() => setViewerSlide(s => s + 1)}
                style={{ position: 'absolute', right: 56, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 40, height: 40, borderRadius: 99, background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronRight size={22} />
              </button>
            )}

            {/* Instagram-style right-side action icons */}
            <div style={{ position: 'absolute', right: 14, bottom: 100, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              {/* Like */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleFavorite(viewerItem.id, !viewerItem.is_favorite, viewerItem); setViewerItem({ ...viewerItem, is_favorite: !viewerItem.is_favorite }); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <Heart size={30} fill={viewerItem.is_favorite ? '#ff3b5c' : 'none'} color={viewerItem.is_favorite ? '#ff3b5c' : '#fff'} strokeWidth={1.8} />
              </button>
              {/* Save */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); openSavePopover(viewerItem, rect); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <Bookmark size={28} fill={viewerItem.is_saved ? '#fff' : 'none'} color="#fff" strokeWidth={1.8} />
              </button>
              {/* Request */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setViewerOpen(false); openRequestModal(viewerItem); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <Send size={26} color="#fff" strokeWidth={1.8} />
              </button>
            </div>

            {/* Carousel dots */}
            {isCarousel && (
              <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 6 }}>
                {slides.map((_, i) => (
                  <button key={i} type="button" onClick={() => setViewerSlide(i)}
                    style={{ width: 7, height: 7, borderRadius: 99, background: i === viewerSlide ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            )}
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
            {(remixItem.thumbnail_url || remixItem.media_urls?.[0]) && (
              <div style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={remixItem.thumbnail_url ?? remixItem.media_urls?.[0]}
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
      {/* ══════════════════════════════════════════════════════════════════════
           MODAL: Enviar solicitud de recreación
         ══════════════════════════════════════════════════════════════════════ */}
      {requestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                Enviar solicitud
              </h2>
              <button type="button" onClick={() => setRequestModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            {requestModal.thumbnail_url && (
              <div style={{ marginBottom: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={requestModal.thumbnail_url} alt="Referencia"
                  style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block', border: '1px solid var(--border)' }} />
                {(requestModal.title || requestModal.category) && (
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    {requestModal.title ?? requestModal.category}
                  </p>
                )}
              </div>
            )}

            {/* Comment */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelSm}>Comentario <span style={{ opacity: 0.6, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>— opcional</span></label>
              <textarea
                value={reqComment}
                onChange={e => setReqComment(e.target.value)}
                placeholder="¿Qué quieres que hagamos distinto? Estilo, mensaje, formato…"
                rows={3}
                style={{ ...inputSt, resize: 'vertical' }}
              />
            </div>

            {/* Timing */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelSm}>¿Cuándo lo necesitas?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  ['asap',           'Sin prisa — cuando podáis'],
                  ['next_two_weeks', 'Próximas 2 semanas'],
                  ['specific_date',  'Fecha concreta'],
                ] as const).map(([val, lbl]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${reqTiming === val ? 'var(--accent)' : 'var(--border)'}`, background: reqTiming === val ? 'var(--accent-soft)' : 'transparent', cursor: 'pointer' }}>
                    <input
                      type="radio" name="timing" value={val} checked={reqTiming === val}
                      onChange={() => setReqTiming(val)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', fontWeight: reqTiming === val ? 600 : 400 }}>{lbl}</span>
                  </label>
                ))}
              </div>
              {reqTiming === 'specific_date' && (
                <input
                  type="date" value={reqDate} onChange={e => setReqDate(e.target.value)}
                  style={{ marginTop: 8, ...inputSt }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 1 }}>
              <button type="button" onClick={() => setRequestModal(null)}
                style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={handleSubmitRequest} disabled={reqSubmitting}
                style={{ flex: 2, padding: 12, border: 'none', background: '#0D9488', color: '#fff', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: reqSubmitting ? 'not-allowed' : 'pointer', opacity: reqSubmitting ? 0.5 : 1 }}>
                {reqSubmitting ? 'Enviando…' : 'Enviar solicitud →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete collection dialog ─────────────────────────────────────── */}
      {deleteDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
              Eliminar colección
            </h3>
            <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              ¿Qué haces con las <strong>{deleteDialog.count}</strong> referencias de <strong>&ldquo;{deleteDialog.name}&rdquo;</strong>?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <button type="button"
                onClick={() => confirmDeleteCollection('keep')}
                disabled={deletingColl}
                style={{ padding: '12px 16px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Mantener en guardadas (sin clasificar)</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>Las referencias se moverán a &ldquo;Sin clasificar&rdquo;</span>
              </button>
              <button type="button"
                onClick={() => confirmDeleteCollection('remove_items')}
                disabled={deletingColl}
                style={{ padding: '12px 16px', border: '1px solid #fee2e2', background: '#fff5f5', color: '#b91c1c', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Eliminar también de guardadas</span>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 400 }}>Las referencias se quitarán de toda tu biblioteca</span>
              </button>
            </div>
            <button type="button" onClick={() => setDeleteDialog(null)}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: f, fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
