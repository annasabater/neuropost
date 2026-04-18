'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, BookmarkCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { InspirationItem, InspirationSource } from './InspirationCard';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface Collection {
  id:          string;
  name:        string;
  description: string | null;
  cover_url:   string | null;
  item_count?: number;
}

interface Props {
  item:       InspirationItem;
  anchor:     DOMRect;
  collections: Collection[];
  onClose:    () => void;
  /** Called when the user adds a collection — parent refreshes its list. */
  onCollectionsChange: (next: Collection[]) => void;
  /** Called with the item's new saved state (and list of collection_ids) so the
   *  parent can update its card state optimistically. */
  onSavedChange: (itemId: string, isSaved: boolean, collectionIds: string[]) => void;
}

export function SavePopover({
  item, anchor, collections, onClose, onCollectionsChange, onSavedChange,
}: Props) {
  const source: InspirationSource = item.source ?? 'legacy';

  // ── State ────────────────────────────────────────────────────────────────
  const [initialSaved,   setInitialSaved]   = useState<Set<string>>(() => new Set(item.saved_collection_ids ?? []));
  const [hasUnfiled,     setHasUnfiled]     = useState<boolean>(!!item.is_saved && (item.saved_collection_ids ?? []).length === 0);
  const [withCollection, setWithCollection] = useState<boolean>((item.saved_collection_ids ?? []).length > 0);
  const [selected,       setSelected]       = useState<string | null>(item.saved_collection_ids?.[0] ?? null);
  const [notes,          setNotes]          = useState<string>('');
  const [loading,        setLoading]        = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [newName,        setNewName]        = useState('');
  const [creatingInline, setCreatingInline] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Fetch authoritative state on open (in case the prop is stale) ────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inspiracion/save?source=${source}&item_id=${encodeURIComponent(item.id)}`);
        if (!res.ok) return;
        const json = await res.json() as {
          is_saved: boolean; collection_ids: string[]; has_unfiled: boolean;
        };
        if (cancelled) return;
        setInitialSaved(new Set(json.collection_ids));
        setHasUnfiled(json.has_unfiled);
        if (json.collection_ids.length > 0) {
          setWithCollection(true);
          setSelected(json.collection_ids[0]);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, source]);

  // ── Close on click outside / Escape ───────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('keydown', onKey);
    // defer to avoid the click that opened the popover from closing it
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  // ── Compute anchored position (below-left of the icon, constrained to viewport) ──
  const pos = useMemo(() => {
    const W = 320;
    const H = 400;
    const margin = 12;
    const top  = Math.min(anchor.bottom + 8, window.innerHeight - H - margin);
    const left = Math.max(margin, Math.min(anchor.right - W, window.innerWidth - W - margin));
    return { top: Math.max(margin, top), left };
  }, [anchor]);

  const isAlreadySaved = initialSaved.size > 0 || hasUnfiled;

  // ── Save action ──────────────────────────────────────────────────────────
  async function handleSave() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        source,
        item_id: item.id,
        collection_id: withCollection ? selected : null,
        notes: notes.trim() || null,
      };
      const res = await fetch('/api/inspiracion/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success(withCollection && selected ? 'Guardado en colección' : 'Guardado');

      // Recompute saved state for the parent
      const nextCollections = new Set(initialSaved);
      let   nextUnfiled     = hasUnfiled;
      if (withCollection && selected) nextCollections.add(selected);
      else                            nextUnfiled = true;
      onSavedChange(item.id, true, Array.from(nextCollections));
      setInitialSaved(nextCollections);
      setHasUnfiled(nextUnfiled);
      onClose();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/inspiracion/save', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, item_id: item.id, all: true }),
      });
      if (!res.ok) throw new Error('Remove failed');
      toast.success('Quitado de guardadas');
      onSavedChange(item.id, false, []);
      onClose();
    } catch {
      toast.error('No se pudo quitar');
    } finally {
      setLoading(false);
    }
  }

  async function createInline() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/inspiracion/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json() as { collection?: Collection; error?: string };
      if (!res.ok || !json.collection) { toast.error(json.error ?? 'Error'); return; }
      onCollectionsChange([...collections, json.collection]);
      setSelected(json.collection.id);
      setNewName('');
      setCreatingInline(false);
    } catch {
      toast.error('No se pudo crear la colección');
    } finally {
      setCreating(false);
    }
  }

  // Look up names for the collections the item is already in (for the top pill)
  const savedCollectionNames = Array.from(initialSaved)
    .map(id => collections.find(c => c.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Guardar referencia"
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 1100,
        width: 320, maxWidth: 'calc(100vw - 24px)',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
        fontFamily: f,
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
      }}>
        <p style={{
          margin: 0, fontFamily: fc, fontWeight: 800, fontSize: 12,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Guardar referencia
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Already saved pill */}
        {isAlreadySaved && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px',
            background: 'var(--accent-soft, rgba(15,118,110,0.08))',
            color: 'var(--accent)',
            fontSize: 12, fontWeight: 600,
          }}>
            <BookmarkCheck size={14} />
            <span>
              Guardado en {
                savedCollectionNames.length > 0
                  ? savedCollectionNames.slice(0, 2).join(', ') + (savedCollectionNames.length > 2 ? ` +${savedCollectionNames.length - 2}` : '')
                  : 'Sin colección'
              }
            </span>
          </div>
        )}

        {/* Collection toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={withCollection}
            onChange={(e) => setWithCollection(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          Añadir a colección
        </label>

        {/* Collection select */}
        {withCollection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {collections.length > 0 && (
              <select
                value={selected ?? ''}
                onChange={(e) => setSelected(e.target.value || null)}
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: f,
                }}
              >
                <option value="">— Elegir colección —</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {/* + Nueva colección */}
            {creatingInline ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createInline();
                    if (e.key === 'Escape') { setCreatingInline(false); setNewName(''); }
                  }}
                  placeholder="Nombre de la colección"
                  autoFocus
                  style={{
                    flex: 1, padding: '8px 10px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: f,
                  }}
                />
                <button
                  type="button"
                  onClick={createInline}
                  disabled={creating || !newName.trim()}
                  style={{
                    padding: '0 10px',
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    fontFamily: fc, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating || !newName.trim() ? 0.5 : 1,
                  }}
                >
                  Crear
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingInline(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '6px 4px',
                  background: 'none', border: 'none',
                  color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: f,
                }}
              >
                <Plus size={13} /> Nueva colección
              </button>
            )}
          </div>
        )}

        {/* Notes (optional) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Notas <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, opacity: 0.7 }}>— opcional</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Por qué la guardas, para cuándo, qué te inspira…"
            style={{
              width: '100%', padding: '8px 10px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-primary)', fontSize: 12, fontFamily: f,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 1, borderTop: '1px solid var(--border)' }}>
        {isAlreadySaved && (
          <button
            type="button"
            onClick={handleRemoveAll}
            disabled={loading}
            style={{
              padding: '10px 12px',
              background: 'var(--bg)', color: '#dc2626', border: 'none',
              fontFamily: f, fontSize: 12, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Trash2 size={13} /> Quitar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1, padding: '10px 12px',
            background: 'var(--bg)', color: 'var(--text-secondary)', border: 'none',
            fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || (withCollection && !selected)}
          style={{
            flex: 1, padding: '10px 12px',
            background: '#111827', color: '#fff', border: 'none',
            fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || (withCollection && !selected) ? 0.5 : 1,
          }}
        >
          {loading ? 'Guardando…' : '✓ Guardar'}
        </button>
      </div>
    </div>
  );
}
