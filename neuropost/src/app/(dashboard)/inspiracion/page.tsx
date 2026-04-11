'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Template = {
  id: string; title: string; description: string; thumbnail_url: string | null;
  sectors: string[]; styles: string[]; format: string; tags: string[]; times_used: number;
};

type Reference = {
  id: string; type: string; source_url: string | null; thumbnail_url: string | null;
  title: string; notes: string | null; style_tags: string[] | null; format: string | null;
  created_at: string; recreation?: { id: string; status: string } | null;
};

const FORMAT_OPTIONS = ['all', 'image', 'reel', 'carousel', 'video'];
const FORMAT_LABEL: Record<string, string> = { all: 'Todos', image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo', story: 'Story' };

function InspirationCard({ image, title, format, onSave, onRecreate }: {
  image: string | null; title: string; description?: string; format?: string;
  tags?: string[]; onSave?: () => void; onRecreate?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', breakInside: 'avoid', marginBottom: 2 }}>
      <div style={{ background: 'var(--bg-1)', minHeight: 200 }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} style={{ width: '100%', display: 'block', objectFit: 'cover', transition: 'transform 0.4s', transform: hovered ? 'scale(1.03)' : 'scale(1)' }} />
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text-tertiary)' }}>🎨</div>
        )}
      </div>
      {format && (
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px' }}>
          {FORMAT_LABEL[format] ?? format}
        </div>
      )}
      {hovered && (onSave || onRecreate) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {onSave && <button type="button" onClick={(e) => { e.stopPropagation(); onSave(); }} style={{ padding: '8px 20px', border: '1px solid #fff', background: 'transparent', color: '#fff', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Guardar</button>}
          {onRecreate && <button type="button" onClick={(e) => { e.stopPropagation(); onRecreate(); }} style={{ padding: '8px 20px', border: 'none', background: '#fff', color: '#111', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Recrear →</button>}
        </div>
      )}
    </div>
  );
}

export default function InspiracionPage() {
  const [tab, setTab] = useState<'explore' | 'saved'>('explore');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [references, setReferences] = useState<Reference[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [filterFormat, setFilterFormat] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  // ── "Añadir referencia" — multi-step request flow ───────────────────────
  const brand = useAppStore((s) => s.brand);
  const planLimits = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowsVideo = planLimits.videosPerWeek > 0;
  const maxImages = planLimits.carouselMaxPhotos;

  const [showAddModal, setShowAddModal] = useState(false);
  // Format the user wants us to *recreate*
  const [addFormat, setAddFormat] = useState<'image' | 'reel' | 'carousel'>('image');
  // Reference: paste URL or upload an image of what they want to recreate
  const [addRefSource, setAddRefSource] = useState<'url' | 'upload'>('url');
  const [addRefUrl, setAddRefUrl] = useState('');
  const [addRefFile, setAddRefFile] = useState<File | null>(null);
  // Their own raw material from library / Instagram
  const [addOwnMedia, setAddOwnMedia] = useState<SelectedMedia[]>([]);
  // How many to generate
  const [addQuantity, setAddQuantity] = useState(1);
  // Optional description
  const [addDescription, setAddDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [recreateTitle, setRecreateTitle] = useState('');
  const [recreateRefId, setRecreateRefId] = useState<string | null>(null);
  const [recreateSourceTemplate, setRecreateSourceTemplate] = useState<Template | null>(null);
  const [recreateRefThumb, setRecreateRefThumb] = useState<string | null>(null);
  const [recreateFormat, setRecreateFormat] = useState<string>('image');
  const [recreateNotes, setRecreateNotes] = useState('');
  const [recreateMedia, setRecreateMedia] = useState<SelectedMedia[]>([]);
  // Per-slot config for carousel recreations.
  type CarouselSlot = {
    include: boolean;            // recreate this slide? false = skip
    ownMediaId: string | null;   // replace with one of the user's own photos
    note: string;                // specific instructions for this slide
  };
  const blankSlot = (): CarouselSlot => ({ include: true, ownMediaId: null, note: '' });
  const [recreateSlotCount, setRecreateSlotCount] = useState(4);
  const [recreateSlots, setRecreateSlots] = useState<CarouselSlot[]>(
    () => Array(4).fill(null).map(blankSlot),
  );
  const [recreating, setRecreating] = useState(false);
  const [recreateSuccess, setRecreateSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/inspiracion/templates').then(r => r.json()).then(d => { setTemplates(d.templates ?? []); setLoadingTemplates(false); }).catch(() => setLoadingTemplates(false));
    fetch('/api/inspiracion/referencias').then(r => r.json()).then(d => { setReferences(d.references ?? []); setLoadingRefs(false); }).catch(() => setLoadingRefs(false));
  }, []);

  const filteredTemplates = templates.filter(t => {
    if (filterFormat !== 'all' && t.format !== filterFormat) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTemplates = filteredTemplates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleFilterChange(v: string) { setFilterFormat(v); setPage(1); }
  function handleTabChange(t: 'explore' | 'saved') { setTab(t); setPage(1); }

  async function saveTemplate(template: Template) {
    const res = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: template.title, thumbnail_url: template.thumbnail_url, format: template.format, style_tags: template.styles, notes: '' }) });
    if (res.ok) { const d = await res.json(); setReferences(p => [d.reference, ...p]); toast.success('Guardado'); } else toast.error('Error');
  }

  function openRecreateForTemplate(t: Template) {
    setRecreateSourceTemplate(t); setRecreateRefId(null);
    setRecreateTitle(t.title); setRecreateFormat(t.format ?? 'image');
    setRecreateRefThumb(t.thumbnail_url ?? null);
    setRecreateNotes(''); setRecreateMedia([]);
    setRecreateSlotCount(4); setRecreateSlots(Array(4).fill(null).map(blankSlot));
    setRecreateSuccess(false); setShowRecreateModal(true);
  }
  function openRecreateForRef(r: Reference) {
    setRecreateSourceTemplate(null); setRecreateRefId(r.id);
    setRecreateTitle(r.title); setRecreateFormat(r.format ?? 'image');
    setRecreateRefThumb(r.thumbnail_url ?? null);
    setRecreateNotes(''); setRecreateMedia([]);
    setRecreateSlotCount(4); setRecreateSlots(Array(4).fill(null).map(blankSlot));
    setRecreateSuccess(false); setShowRecreateModal(true);
  }

  async function handleSaveReference() {
    // Validation: must have a reference (URL or upload) and a description OR own photos
    const hasRef = (addRefSource === 'url' && addRefUrl.trim().length > 0) || (addRefSource === 'upload' && !!addRefFile);
    if (!hasRef) { toast.error('Pega una URL o sube una imagen de referencia'); return; }
    if (addFormat === 'reel' && !allowsVideo) {
      toast.error('Tu plan actual no incluye vídeos. Mejora tu plan para pedir reels.');
      return;
    }
    if (addQuantity < 1 || addQuantity > maxImages) {
      toast.error(`Cantidad fuera de rango (1–${maxImages})`);
      return;
    }
    setSaving(true);
    try {
      // 1) Upload reference image if needed
      let thumbnailUrl: string | null = null;
      if (addRefSource === 'upload' && addRefFile) {
        const fd = new FormData();
        fd.append('file', addRefFile);
        const up = await fetch('/api/inspiracion/upload', { method: 'POST', body: fd });
        if (up.ok) { const d = await up.json(); thumbnailUrl = d.url ?? null; }
      }
      // 2) Create the inspiration_reference row (still no title — derive from description)
      const refTitle = addDescription.trim().slice(0, 80) || `Referencia ${addFormat}`;
      const refRes = await fetch('/api/inspiracion/referencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: addRefSource,
          source_url: addRefSource === 'url' ? (addRefUrl || null) : null,
          thumbnail_url: thumbnailUrl,
          title: refTitle,
          notes: addDescription.trim() || null,
          format: addFormat,
        }),
      });
      if (!refRes.ok) {
        const e = await refRes.json().catch(() => ({}));
        toast.error(`Error al guardar la referencia: ${e.error ?? refRes.status}`);
        setSaving(false);
        return;
      }
      const refData = await refRes.json();
      const newRef = refData.reference;
      if (!newRef?.id) {
        toast.error('Respuesta inválida del servidor (referencia)');
        setSaving(false);
        return;
      }

      // 3) Create the recreation_request immediately so workers can pick it up
      const ownUrls = addOwnMedia.map((m) => m.url);
      const recRes = await fetch('/api/inspiracion/recrear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: newRef.id,
          client_notes: [
            addDescription.trim(),
            `[FORMATO_DESEADO] ${addFormat}`,
            `[CANTIDAD] ${addQuantity}`,
          ].filter(Boolean).join('\n'),
          media_urls: ownUrls,
          style_to_adapt: [],
        }),
      });
      let recreation: { id: string; status: string } | null = null;
      if (recRes.ok) {
        const recData = await recRes.json();
        recreation = recData.recreation ? { id: recData.recreation.id, status: recData.recreation.status } : null;
      } else {
        const e = await recRes.json().catch(() => ({}));
        toast.error(`Error al crear la solicitud: ${e.error ?? e.details ?? recRes.status}`);
        setSaving(false);
        return;
      }

      // 4) Also create posts in /posts with status 'request' so they show as
      //    "En preparación" in the user's posts page. One post per piece.
      //    Carousel: also include the ordered media URLs in metadata so the worker
      //    knows the user's preferred slide order.
      const postsToCreate = addFormat === 'reel' ? 1 : addQuantity;
      const orderedUrls = addOwnMedia.map((m) => m.url);
      const meta = JSON.stringify({
        from_inspiration: true,
        reference_id: newRef.id,
        recreation_id: recreation?.id ?? null,
        request_kind: 'inspiration_recreation',
        format: addFormat,
        quantity: addQuantity,
        global_description: addDescription.trim(),
        ordered_media_urls: orderedUrls, // worker will keep this order for carousels
      });
      for (let i = 0; i < postsToCreate; i++) {
        await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: addDescription.trim() || `Recreación inspirada — ${addFormat}`,
            image_url: orderedUrls[i] ?? orderedUrls[0] ?? thumbnailUrl ?? null,
            status: 'request',
            format: addFormat,
            platform: ['instagram'],
            scheduled_at: null,
            ai_explanation: meta,
          }),
        }).catch(() => null);
      }

      // 5) Update local list — show new reference with its in-progress recreation
      setReferences((p) => [{ ...newRef, recreation }, ...p]);
      setAddSuccess(true);
      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess(false);
        resetAddForm();
      }, 1800);
    } catch {
      toast.error('Error al enviar');
    } finally {
      setSaving(false);
    }
  }

  function resetAddForm() {
    setAddFormat('image');
    setAddRefSource('url');
    setAddRefUrl('');
    setAddRefFile(null);
    setAddOwnMedia([]);
    setAddQuantity(1);
    setAddDescription('');
  }

  async function handleRecreate() {
    if (!recreateNotes.trim() && recreateMedia.length === 0) {
      toast.error('Describe qué quieres o adjunta al menos una foto');
      return;
    }
    setRecreating(true);
    let refId = recreateRefId;
    if (recreateSourceTemplate && !refId) {
      const sr = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: recreateSourceTemplate.title, thumbnail_url: recreateSourceTemplate.thumbnail_url, format: recreateSourceTemplate.format, style_tags: recreateSourceTemplate.styles, notes: '' }) });
      if (sr.ok) { const sd = await sr.json(); refId = sd.reference?.id ?? null; if (sd.reference) setReferences(p => [sd.reference, ...p]); }
    }
    if (!refId) { toast.error('Error'); setRecreating(false); return; }
    const mediaUrls = recreateMedia.map((m) => m.url);
    // For carousels, build a human-readable per-slot plan and append to notes
    // so the worker can read it directly without parsing JSON.
    let composedNotes = recreateNotes.trim();
    if (recreateFormat === 'carousel') {
      const lines = recreateSlots.slice(0, recreateSlotCount).map((s, i) => {
        const header = `Slot ${i + 1}:`;
        if (!s.include) return `${header} NO HACER`;
        const parts: string[] = [];
        if (s.ownMediaId) {
          const owned = recreateMedia.find((m) => m.id === s.ownMediaId);
          if (owned) parts.push(`usar mi foto → ${owned.url}`);
          else parts.push('basarse en la diapositiva de la referencia');
        } else {
          parts.push('basarse en la diapositiva de la referencia');
        }
        if (s.note.trim()) parts.push(`indicaciones: ${s.note.trim()}`);
        return `${header} ${parts.join(' · ')}`;
      });
      composedNotes = `${composedNotes ? composedNotes + '\n\n' : ''}[CARRUSEL — ${recreateSlotCount} slots]\n${lines.join('\n')}`;
    }
    const res = await fetch('/api/inspiracion/recrear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_id: refId,
        client_notes: composedNotes || null,
        media_urls: mediaUrls,
        style_to_adapt: [],
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(`Error al crear la solicitud: ${e.error ?? e.details ?? res.status}`);
      setRecreating(false);
      return;
    }
    const d = await res.json();
    if (d.recreation) setReferences(p => p.map(r => r.id === refId ? { ...r, recreation: { id: d.recreation.id, status: d.recreation.status } } : r));

    // Also create the corresponding posts in /posts with status 'request'
    // so the user sees them under "En preparación".
    // For carousel: 1 post per *included* slot. For image/reel: 1 post.
    const ownUrls = recreateMedia.map((m) => m.url);
    let postsToCreate: { caption: string; image_url: string | null }[] = [];
    if (recreateFormat === 'carousel') {
      postsToCreate = recreateSlots.slice(0, recreateSlotCount)
        .map((s, i) => ({ slot: s, idx: i }))
        .filter((x) => x.slot.include)
        .map(({ slot, idx }) => {
          const owned = slot.ownMediaId ? recreateMedia.find((m) => m.id === slot.ownMediaId) ?? null : null;
          const captionParts = [
            `Recreación inspirada (${idx + 1}/${recreateSlotCount}) — ${recreateTitle}`,
          ];
          if (slot.note.trim()) captionParts.push(slot.note.trim());
          return {
            caption: captionParts.join(' — '),
            image_url: owned?.url ?? recreateRefThumb ?? null,
          };
        });
    } else {
      postsToCreate = [{
        caption: `Recreación inspirada — ${recreateTitle}${recreateNotes.trim() ? ' — ' + recreateNotes.trim() : ''}`,
        image_url: ownUrls[0] ?? recreateRefThumb ?? null,
      }];
    }
    const meta = JSON.stringify({
      from_inspiration: true,
      reference_id: refId,
      recreation_id: d.recreation?.id ?? null,
      request_kind: 'inspiration_recreation',
      format: recreateFormat,
      global_description: recreateNotes.trim(),
      ordered_media_urls: ownUrls,
    });
    for (const p of postsToCreate) {
      await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: p.caption,
          image_url: p.image_url,
          status: 'request',
          format: recreateFormat,
          platform: ['instagram'],
          scheduled_at: null,
          ai_explanation: meta,
        }),
      }).catch(() => null);
    }

    setRecreateSuccess(true);
    setTimeout(() => { setShowRecreateModal(false); setRecreateSuccess(false); setRecreating(false); setRecreateMedia([]); }, 2000);
  }

  async function handleDeleteRef(id: string) { const res = await fetch(`/api/inspiracion/referencias/${id}`, { method: 'DELETE' }); if (res.ok) { setReferences(p => p.filter(r => r.id !== id)); toast.success('Eliminada'); } else toast.error('Error'); }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div className="page-content dashboard-feature-page dashboard-unified-page" style={{ maxWidth: 1000 }}>
      <div className="dashboard-feature-header dashboard-unified-header" style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12 }}>Inspiración</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>Encuentra el estilo perfecto para tu negocio</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '10px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Plus size={14} /> Añadir referencia
        </button>
      </div>

      <div className="dashboard-feature-body dashboard-unified-content">

      <div style={{ display: 'flex', gap: 32, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['explore', 'saved'] as const).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, fontFamily: fc, fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: tab === t ? '2px solid var(--text-primary)' : '2px solid transparent', transition: 'all 0.15s' }}>
            {t === 'explore' ? 'Explorar' : `Guardadas (${references.length})`}
          </button>
        ))}
      </div>

      {tab === 'explore' && (
        <>
          <div className="inspiration-format-bar" style={{ display: 'flex', marginBottom: 24, background: '#000', border: '1px solid #000', padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.75)' }}>Formato</span>
              {FORMAT_OPTIONS.map(v => <button key={v} onClick={() => handleFilterChange(v)} style={{ background: filterFormat === v ? '#ffffff' : 'transparent', border: filterFormat === v ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.32)', cursor: 'pointer', fontFamily: f, fontSize: 12, fontWeight: 600, color: filterFormat === v ? '#000' : '#ffffff', padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s' }}>{FORMAT_LABEL[v]}</button>)}
            </div>
          </div>

          {loadingTemplates ? <p style={{ color: 'var(--text-tertiary)', fontFamily: f }}>Cargando...</p>
          : filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin resultados</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f }}>Prueba con otros filtros</p>
            </div>
          ) : (
            <>
            <div className="inspiration-gallery-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: 'transparent', padding: 0 }}>
              {pagedTemplates.map(t => (
                <div key={t.id} style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <InspirationCard image={t.thumbnail_url} title={t.title} description={t.description} format={t.format} tags={t.tags} onSave={() => saveTemplate(t)} onRecreate={() => openRecreateForTemplate(t)} />
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 24 }}>
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}>← Anterior</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button type="button" key={n} onClick={() => setPage(n)}
                    style={{ minWidth: 36, padding: '8px 12px', border: '1px solid var(--border)', background: n === currentPage ? 'var(--text-primary)' : 'var(--bg)', color: n === currentPage ? 'var(--bg)' : 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                ))}
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}>Siguiente →</button>
              </div>
            )}
            </>
          )}
        </>
      )}

      {tab === 'saved' && (
        <>
          {loadingRefs ? <p style={{ color: 'var(--text-tertiary)', fontFamily: f }}>Cargando...</p>
          : references.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin referencias</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 32 }}>Explora ideas y guárdalas aquí</p>
              <button onClick={() => setTab('explore')} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '14px 32px', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>Explorar →</button>
            </div>
          ) : (
            <div className="inspiration-gallery-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: 'transparent', padding: 0 }}>
              {references.map(ref => (
                <div key={ref.id} style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
                  <InspirationCard image={ref.thumbnail_url} title={ref.title} description={ref.notes ?? ''} format={ref.format ?? undefined} onRecreate={ref.recreation ? undefined : () => openRecreateForRef(ref)} />
                  <button onClick={() => handleDeleteRef(ref.id)} title="Eliminar referencia" aria-label="Eliminar referencia" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', padding: '4px 6px', cursor: 'pointer' }}><Trash2 size={12} /> Eliminar</button>
                  {ref.recreation && <div style={{ position: 'absolute', top: 8, left: 8, background: ref.recreation.status === 'completed' ? 'var(--accent)' : 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ref.recreation.status === 'completed' ? 'Recreado' : 'En preparación'}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Add reference (multi-step) */}
      {showAddModal && (() => {
        const labelSm: React.CSSProperties = { display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 };
        const FORMATS: { v: 'image' | 'reel' | 'carousel'; l: string; locked?: boolean; lockMsg?: string }[] = [
          { v: 'image',    l: 'Imagen' },
          { v: 'carousel', l: 'Carrusel' },
          { v: 'reel',     l: 'Reel (vídeo)', locked: !allowsVideo, lockMsg: 'No incluido en tu plan' },
        ];
        const reelLocked = addFormat === 'reel' && !allowsVideo;
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Añadir referencia</h2>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} className="icon-close-button" title="Cerrar modal" aria-label="Cerrar modal">Cerrar<X size={20} /></button>
            </div>

            {addSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ En preparación</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en tu solicitud. Te avisaremos cuando esté listo.</p>
              </div>
            ) : (
            <>
              {/* STEP 1 — Format */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelSm}>1. ¿Qué quieres que creemos?</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FORMATS.map(({ v, l, locked, lockMsg }) => {
                    const active = addFormat === v;
                    return (
                      <button type="button" key={v} disabled={locked} onClick={() => setAddFormat(v)} style={{
                        padding: '10px 16px',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : 'var(--bg)',
                        color: active ? '#ffffff' : (locked ? 'var(--text-tertiary)' : 'var(--text-secondary)'),
                        fontFamily: f, fontSize: 12, fontWeight: 600,
                        cursor: locked ? 'not-allowed' : 'pointer',
                        opacity: locked ? 0.55 : 1,
                      }} title={locked ? lockMsg : undefined}>
                        {l}{locked ? ' 🔒' : ''}
                      </button>
                    );
                  })}
                </div>
                {reelLocked && (
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--warning, #e65100)', marginTop: 8 }}>
                    ⚠ Tu plan actual no incluye vídeos. Mejora a Pro o Total para pedir reels.
                  </p>
                )}
              </div>

              {/* STEP 2 — Reference (URL or upload) */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelSm}>2. Tu referencia — lo que quieres que se parezca</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', marginBottom: 10 }}>
                  {(['url', 'upload'] as const).map((t) => (
                    <button type="button" key={t} onClick={() => setAddRefSource(t)} style={{
                      flex: 1, padding: 8, border: 'none', cursor: 'pointer',
                      background: addRefSource === t ? 'var(--text-primary)' : 'var(--bg)',
                      color: addRefSource === t ? 'var(--bg)' : 'var(--text-tertiary)',
                      fontFamily: f, fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{t === 'url' ? 'Pegar URL' : 'Subir imagen'}</button>
                  ))}
                </div>
                {addRefSource === 'url' ? (
                  <input value={addRefUrl} onChange={(e) => setAddRefUrl(e.target.value)}
                    placeholder="https://instagram.com/p/..." style={inputStyle} />
                ) : (
                  <input ref={fileInputRef} type="file" accept="image/*,video/*"
                    onChange={(e) => setAddRefFile(e.target.files?.[0] ?? null)} style={inputStyle} />
                )}
              </div>

              {/* STEP 3 — Own raw material */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelSm}>
                  3. Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— de tu biblioteca o Instagram (opcional, varias permitidas)</span>
                </label>
                <MediaPicker selected={addOwnMedia} onChange={setAddOwnMedia} max={maxImages} />

                {/* Reorder strip — only when carousel-relevant or >1 selected */}
                {addOwnMedia.length > 1 && (
                  <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg-1)' }}>
                    <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      Orden de publicación <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— arrastra o usa las flechas para reordenar el carrusel</span>
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {addOwnMedia.map((m, idx) => (
                        <div key={m.id} style={{ position: 'relative', width: 76 }}>
                          <div style={{ position: 'relative', width: 76, height: 76, background: '#000' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <div style={{
                              position: 'absolute', bottom: 2, left: 2,
                              background: 'var(--accent)', color: '#ffffff',
                              fontFamily: fc, fontSize: 10, fontWeight: 700,
                              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{idx + 1}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 1, marginTop: 4 }}>
                            <button type="button" disabled={idx === 0}
                              onClick={() => setAddOwnMedia((arr) => {
                                const next = [...arr];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                return next;
                              })}
                              title="Mover a la izquierda"
                              style={{ flex: 1, padding: 4, border: '1px solid var(--border)', background: 'var(--bg)', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontFamily: f, fontSize: 12, fontWeight: 700, color: idx === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)', opacity: idx === 0 ? 0.4 : 1 }}>←</button>
                            <button type="button" disabled={idx === addOwnMedia.length - 1}
                              onClick={() => setAddOwnMedia((arr) => {
                                const next = [...arr];
                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                return next;
                              })}
                              title="Mover a la derecha"
                              style={{ flex: 1, padding: 4, border: '1px solid var(--border)', borderLeft: 'none', background: 'var(--bg)', cursor: idx === addOwnMedia.length - 1 ? 'not-allowed' : 'pointer', fontFamily: f, fontSize: 12, fontWeight: 700, color: idx === addOwnMedia.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', opacity: idx === addOwnMedia.length - 1 ? 0.4 : 1 }}>→</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 4 — Quantity to generate */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelSm}>
                  4. ¿Cuántas {addFormat === 'reel' ? 'piezas' : 'fotos'} quieres que generemos?
                </label>
                {addFormat === 'reel' ? (
                  <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {allowsVideo
                      ? `Te entregaremos 1 reel. Tu plan permite hasta ${planLimits.videosPerWeek} vídeos a la semana.`
                      : 'Tu plan no incluye vídeos.'}
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                      {Array.from({ length: Math.min(maxImages, 10) }, (_, i) => i + 1).map((n, i, arr) => (
                        <button type="button" key={n} onClick={() => setAddQuantity(n)} style={{
                          minWidth: 42, padding: '10px 12px',
                          border: `1px solid ${addQuantity === n ? 'var(--accent)' : 'var(--border)'}`,
                          borderRight: i < arr.length - 1 ? 'none' : `1px solid ${addQuantity === n ? 'var(--accent)' : 'var(--border)'}`,
                          background: addQuantity === n ? 'var(--accent)' : 'var(--bg)',
                          color: addQuantity === n ? '#ffffff' : 'var(--text-tertiary)',
                          fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>{n}</button>
                      ))}
                    </div>
                    <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                      Tu plan permite hasta <strong style={{ color: 'var(--text-primary)' }}>{maxImages}</strong> {addFormat === 'carousel' ? 'fotos por carrusel' : 'fotos'}.
                    </p>
                  </>
                )}
              </div>

              {/* STEP 5 — Optional description */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelSm}>5. Descripción <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                <textarea value={addDescription} onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="Cuéntanos qué quieres conseguir, tono, qué destacar..."
                  rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: 1 }}>
                <button onClick={() => { setShowAddModal(false); resetAddForm(); }} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSaveReference} disabled={saving || reelLocked} style={{ flex: 2, padding: 12, border: 'none', background: reelLocked ? 'var(--bg-2)' : 'var(--text-primary)', color: reelLocked ? 'var(--text-tertiary)' : 'var(--bg)', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: reelLocked ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Enviando...' : 'Enviar solicitud →'}</button>
              </div>
            </>
            )}
          </div>
        </div>
        );
      })()}

      {/* Modal: Recreate */}
      {showRecreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', flex: 1 }}>Recrear: {recreateTitle}</h2>
              <button onClick={() => setShowRecreateModal(false)} className="icon-close-button" title="Cerrar modal" aria-label="Cerrar modal">Cerrar<X size={20} /></button>
            </div>
            {recreateSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ En preparación</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en ello. Te avisaremos cuando esté listo.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— de tu biblioteca o Instagram (opcional, varias permitidas)</span>
                  </label>
                  <MediaPicker selected={recreateMedia} onChange={setRecreateMedia} max={10} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  {recreateFormat === 'reel' || recreateFormat === 'video' ? (
                    <>
                      <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                        Indícanos qué quieres recrear con el contenido seleccionado <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span>
                      </label>
                      <textarea value={recreateNotes} onChange={e => setRecreateNotes(e.target.value)} placeholder="Ej: mantén el ritmo y la música, cambia los planos por los míos, pon el logo al final..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 10px', background: 'var(--accent-soft, rgba(15,118,110,0.08))', border: '1px solid var(--accent)' }}>
                        <span style={{ fontFamily: fc, fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          ✦ Generado con IA
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                        Indícanos qué quieres mantener y qué quieres cambiar del contenido seleccionado. <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span>
                      </label>
                      <textarea value={recreateNotes} onChange={e => setRecreateNotes(e.target.value)} placeholder="Describe lo que quieres recrear..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                    </>
                  )}
                </div>

                {/* Per-slot config — only carousels */}
                {recreateFormat === 'carousel' && (
                  <div style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', background: 'var(--bg-1)' }}>
                    <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                      Diapositivas del carrusel <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— para cada una elige si la quieres y cómo</span>
                    </label>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', marginRight: 6 }}>Nº de diapositivas:</span>
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <button type="button" key={n} onClick={() => {
                          setRecreateSlotCount(n);
                          setRecreateSlots((prev) => {
                            const next = [...prev];
                            while (next.length < n) next.push(blankSlot());
                            return next.slice(0, n);
                          });
                        }} style={{
                          minWidth: 28, padding: '4px 8px',
                          border: `1px solid ${recreateSlotCount === n ? 'var(--accent)' : 'var(--border)'}`,
                          background: recreateSlotCount === n ? 'var(--accent)' : 'var(--bg)',
                          color: recreateSlotCount === n ? '#ffffff' : 'var(--text-tertiary)',
                          fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}>{n}</button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {Array.from({ length: recreateSlotCount }, (_, i) => i).map((i) => {
                        const slot = recreateSlots[i] ?? blankSlot();
                        const setSlot = (patch: Partial<CarouselSlot>) => setRecreateSlots((prev) => {
                          const next = [...prev];
                          while (next.length < recreateSlotCount) next.push(blankSlot());
                          next[i] = { ...next[i], ...patch };
                          return next;
                        });
                        const previewUrl = slot.ownMediaId
                          ? recreateMedia.find((m) => m.id === slot.ownMediaId)?.url ?? recreateRefThumb
                          : recreateRefThumb;
                        return (
                          <div key={i} style={{
                            display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12,
                            padding: 12, background: 'var(--bg)', border: '1px solid var(--border)',
                            opacity: slot.include ? 1 : 0.55,
                          }}>
                            {/* Slide preview */}
                            <div style={{ position: 'relative' }}>
                              {previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={previewUrl} alt={`Diapositiva ${i + 1}`}
                                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{ width: '100%', height: 120, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontFamily: f, fontSize: 11 }}>
                                  Sin preview
                                </div>
                              )}
                              <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{i + 1}</span>
                              {!slot.include && (
                                <span style={{ position: 'absolute', bottom: 4, left: 4, background: '#000', color: '#ffffff', fontFamily: f, fontSize: 9, fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>No hacer</span>
                              )}
                            </div>

                            {/* Controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {/* Include toggle */}
                              <div style={{ display: 'flex', gap: 0 }}>
                                <button type="button" onClick={() => setSlot({ include: true })} style={{
                                  flex: 1, padding: '6px 10px',
                                  border: `1px solid ${slot.include ? 'var(--accent)' : 'var(--border)'}`,
                                  background: slot.include ? 'var(--accent)' : 'var(--bg)',
                                  color: slot.include ? '#ffffff' : 'var(--text-secondary)',
                                  fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>Sí, recrearla</button>
                                <button type="button" onClick={() => setSlot({ include: false, ownMediaId: null })} style={{
                                  flex: 1, padding: '6px 10px', borderLeft: 'none',
                                  border: `1px solid ${!slot.include ? 'var(--text-primary)' : 'var(--border)'}`,
                                  background: !slot.include ? 'var(--text-primary)' : 'var(--bg)',
                                  color: !slot.include ? 'var(--bg)' : 'var(--text-secondary)',
                                  fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>No hacer</button>
                              </div>

                              {slot.include && (
                                <>
                                  {/* Own media picker */}
                                  <div>
                                    <span style={{ display: 'block', fontFamily: f, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                      Usar una de mis fotos (opcional)
                                    </span>
                                    {recreateMedia.length === 0 ? (
                                      <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
                                        Sube fotos arriba si quieres asignar una a esta diapositiva.
                                      </p>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <button type="button" onClick={() => setSlot({ ownMediaId: null })} style={{
                                          padding: '4px 8px',
                                          border: `1px solid ${slot.ownMediaId == null ? 'var(--accent)' : 'var(--border)'}`,
                                          background: slot.ownMediaId == null ? 'var(--accent)' : 'var(--bg)',
                                          color: slot.ownMediaId == null ? '#ffffff' : 'var(--text-tertiary)',
                                          fontFamily: f, fontSize: 9, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        }}>Ninguna</button>
                                        {recreateMedia.map((m, mi) => {
                                          const active = slot.ownMediaId === m.id;
                                          return (
                                            <button type="button" key={m.id} onClick={() => setSlot({ ownMediaId: active ? null : m.id })}
                                              title={`Usar mi foto ${mi + 1}`}
                                              style={{
                                                position: 'relative', width: 36, height: 36, padding: 0,
                                                border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                                                background: '#000', cursor: 'pointer',
                                              }}>
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                              <span style={{ position: 'absolute', bottom: -1, right: -1, background: 'var(--accent)', color: '#ffffff', fontFamily: fc, fontSize: 8, fontWeight: 700, width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{mi + 1}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Per-slide note */}
                                  <div>
                                    <span style={{ display: 'block', fontFamily: f, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                      Indicaciones para esta diapositiva (opcional)
                                    </span>
                                    <textarea
                                      value={slot.note}
                                      onChange={(e) => setSlot({ note: e.target.value })}
                                      placeholder="Ej: aquí destaca el precio en grande, fondo más claro..."
                                      rows={2}
                                      style={{
                                        width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
                                        fontFamily: f, fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                                        background: 'var(--bg)', resize: 'vertical', boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 1 }}>
                  <button onClick={() => setShowRecreateModal(false)} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleRecreate} disabled={recreating} style={{ flex: 2, padding: 12, border: 'none', background: 'var(--text-primary)', color: 'var(--bg)', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: recreating ? 0.5 : 1 }}>{recreating ? 'Enviando...' : 'Enviar solicitud →'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
