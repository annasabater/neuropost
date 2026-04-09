'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Wand2, RefreshCw, Image as ImageIcon, Check, Flame, X, Play, ChevronLeft, ChevronRight, ArrowRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Platform, PostFormat, PostGoal, EditorOutput, CopywriterOutput } from '@/types';
import { PostPreview } from './PostPreview';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type LibItem = { id: string; url: string; type: 'image' | 'video'; duration: number | null };
type InspirationRef = { id: string; title: string | null; thumbnail_url: string | null; source_url: string | null; notes: string | null; style_tags: string[] | null; format: string | null };

type ImageSlot = {
  url: string;
  source: 'library' | 'upload';
  b64: string | null;
  mime: string;
  context: string;
  inspiration: InspirationRef | null;
};

interface Props {
  brandName: string;
  allowStories?: boolean;
  onSave: (data: {
    imageUrl: string | null;
    caption: string;
    hashtags: string[];
    platforms: Platform[];
    format: PostFormat;
    goal: PostGoal;
    aiExplanation?: string;
    qualityScore?: number;
    isStory?: boolean;
  }) => Promise<void>;
}

export function PostEditor({ brandName, allowStories = false, onSave }: Props) {
  const t = useTranslations('posts');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserClient();

  // ── Multi-image state ──
  const [slots, setSlots] = useState<ImageSlot[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [step, setStep] = useState<'select' | 'configure' | 'generate'>('select');

  // ── Image source ──
  const [imgSource, setImgSource] = useState<'library' | 'upload'>('library');
  const [library, setLibrary] = useState<LibItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);

  // ── Inspirations ──
  const [showInspo, setShowInspo] = useState(false);
  const [inspirations, setInspirations] = useState<InspirationRef[]>([]);
  const [loadingInspo, setLoadingInspo] = useState(false);

  // ── Common settings ──
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>(['instagram']);
  const [format, setFormat] = useState<PostFormat>('image');
  const [goal, setGoal] = useState<PostGoal>('engagement');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('instagram');
  const [isStory, setIsStory] = useState(false);

  // ── AI state ──
  const [editorResult, setEditorResult] = useState<EditorOutput | null>(null);
  const [copywriterResult, setCopywriterResult] = useState<CopywriterOutput | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FORMATS: { value: PostFormat; label: string }[] = [
    { value: 'image', label: t('formats.image') },
    { value: 'reel', label: t('formats.reel') },
    { value: 'carousel', label: t('formats.carousel') },
    { value: 'story', label: t('formats.story') },
  ];
  const GOALS: { value: PostGoal; label: string }[] = [
    { value: 'engagement', label: 'Engagement' },
    { value: 'awareness', label: 'Awareness' },
    { value: 'promotion', label: t('goals.promotion') },
    { value: 'community', label: t('goals.community') },
  ];

  const activeSlot = slots[activeIdx] ?? null;
  const selectedLibIds = new Set(slots.filter(s => s.source === 'library').map(s => s.url));

  // ── Load library on mount ──
  useEffect(() => {
    async function load() {
      setLoadingLib(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingLib(false); return; }
      const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
      if (!brand) { setLoadingLib(false); return; }
      const { data } = await supabase
        .from('media_library').select('id, url, type, duration')
        .eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(60);
      setLibrary((data ?? []) as LibItem[]);
      setLoadingLib(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load inspirations ──
  useEffect(() => {
    if (!showInspo || inspirations.length > 0) return;
    async function load() {
      setLoadingInspo(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingInspo(false); return; }
      const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
      if (!brand) { setLoadingInspo(false); return; }
      const { data } = await supabase
        .from('inspiration_references')
        .select('id, title, thumbnail_url, source_url, notes, style_tags, format')
        .eq('brand_id', brand.id).eq('is_saved', true)
        .order('created_at', { ascending: false }).limit(30);
      setInspirations((data ?? []) as InspirationRef[]);
      setLoadingInspo(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInspo]);

  // ── Helpers ──
  function toggleLibImage(item: LibItem) {
    if (selectedLibIds.has(item.url)) {
      setSlots(prev => prev.filter(s => s.url !== item.url));
    } else {
      setSlots(prev => [...prev, { url: item.url, source: 'library', b64: null, mime: 'image/jpeg', context: '', inspiration: null }]);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const mime = file.type as string;
      const url = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = (ev.target?.result as string).split(',')[1];
        setSlots(prev => [...prev, { url, source: 'upload', b64, mime, context: '', inspiration: null }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeSlot(idx: number) {
    setSlots(prev => prev.filter((_, i) => i !== idx));
    if (activeIdx >= slots.length - 1 && activeIdx > 0) setActiveIdx(activeIdx - 1);
  }

  function updateSlot(idx: number, patch: Partial<ImageSlot>) {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function togglePlatform(p: Platform) {
    setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);
  }

  // ── AI ──
  async function analyseImage() {
    if (!activeSlot) return;
    // For library images we need to fetch b64 or use URL-based analysis
    setAnalysing(true); setError(null);
    try {
      const body: Record<string, unknown> = { editingLevel: 1, photoContext: activeSlot.context || undefined };
      if (activeSlot.b64) {
        body.image = activeSlot.b64; body.imageType = 'base64'; body.mimeType = activeSlot.mime;
      } else {
        body.image = activeSlot.url; body.imageType = 'url';
      }
      const res = await fetch('/api/agents/editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error al analizar');
      setEditorResult(json.data as EditorOutput);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setAnalysing(false); }
  }

  async function generateCopy() {
    if (!editorResult) return;
    setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/agents/copywriter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visualTags: editorResult.visualTags, imageAnalysis: editorResult.analysis, goal, platforms, postContext: activeSlot?.context || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error al generar copy');
      const data = json.data as CopywriterOutput;
      setCopywriterResult(data);
      const primary = platforms[0];
      if (data.copies[primary]) setCaption(data.copies[primary]!.caption);
      setHashtags([...data.hashtags.branded, ...data.hashtags.niche, ...data.hashtags.broad].slice(0, 15));
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      // Save for the active/first image
      let finalUrl = activeSlot?.url ?? null;
      if (activeSlot?.b64 && activeSlot.url.startsWith('blob:')) {
        setUploading(true);
        try {
          const ext = activeSlot.mime.split('/')[1] ?? 'jpg';
          const path = `${crypto.randomUUID()}.${ext}`;
          const byteString = atob(activeSlot.b64);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          const blob = new Blob([ab], { type: activeSlot.mime });
          const { error: upErr } = await supabase.storage.from('posts').upload(path, blob, { contentType: activeSlot.mime });
          if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          finalUrl = publicUrl;
        } finally { setUploading(false); }
      }

      const inspoMeta = activeSlot?.inspiration ? `Inspiración: ${activeSlot.inspiration.title || activeSlot.inspiration.id}` : '';
      const aiMeta = [editorResult?.editingNarrative, inspoMeta].filter(Boolean).join(' | ');

      await onSave({
        imageUrl: finalUrl, caption, hashtags, platforms, format, goal,
        aiExplanation: aiMeta || undefined,
        qualityScore: editorResult?.analysis.qualityScore,
        isStory: isStory && platforms.includes('instagram'),
      });
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  }

  // ── Tab style helper ──
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 11, fontFamily: f, fontWeight: 600, cursor: 'pointer',
    background: active ? '#111827' : 'var(--bg)',
    color: active ? '#ffffff' : 'var(--text-tertiary)',
    border: `1px solid ${active ? '#111827' : 'var(--border)'}`,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
  });

  // ══════════════════════════════════════════════════════════════════
  // STEP 1: SELECT IMAGES
  // ══════════════════════════════════════════════════════════════════
  if (step === 'select') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 4 }}>
              Paso 1 de 3
            </p>
            <p style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
              Selecciona tus imágenes
            </p>
          </div>
          {slots.length > 0 && (
            <button onClick={() => { setActiveIdx(0); setStep('configure'); }} style={{
              padding: '10px 24px', background: '#111827', color: '#ffffff', border: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Continuar ({slots.length}) <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          <button type="button" onClick={() => setImgSource('library')} style={{ ...tabBtn(imgSource === 'library'), borderRight: 'none' }}>
            <ImageIcon size={12} /> Biblioteca
          </button>
          <button type="button" onClick={() => setImgSource('upload')} style={tabBtn(imgSource === 'upload')}>
            <Upload size={12} /> Subir
          </button>
        </div>

        {/* Selected strip */}
        {slots.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', overflowX: 'auto', width: 'fit-content' }}>
            {slots.map((s, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0, width: 64, height: 64 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeSlot(i)} style={{
                  position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                  background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>
                  <X size={10} color="#ffffff" />
                </button>
                <div style={{
                  position: 'absolute', bottom: 2, left: 2,
                  background: '#111827', color: '#ffffff',
                  fontFamily: fc, fontSize: 9, fontWeight: 700,
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {imgSource === 'library' ? (
          <div style={{ border: '1px solid var(--border)', maxHeight: 420, overflowY: 'auto', background: 'var(--bg-1)' }}>
            {loadingLib ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)' }}>Cargando biblioteca...</p>
              </div>
            ) : library.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <ImageIcon size={28} style={{ color: 'var(--border)', marginBottom: 10 }} />
                <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>Tu biblioteca está vacía</p>
                <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.6 }}>Sube contenido o conéctalo desde Instagram</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)' }}>
                {library.map(item => {
                  const isSel = selectedLibIds.has(item.url);
                  return (
                    <div key={item.id} onClick={() => toggleLibImage(item)}
                      style={{ position: 'relative', cursor: 'pointer', background: '#000' }}>
                      {item.type === 'video' ? (
                        <>
                          <video src={item.url} muted preload="metadata"
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', pointerEvents: 'none' }}>
                            <Play size={18} fill="#fff" color="#fff" style={{ opacity: 0.85 }} />
                          </div>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      )}
                      {isSel && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,118,110,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 24, height: 24, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={14} color="#ffffff" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', padding: 40, textAlign: 'center', background: 'var(--bg-1)', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
            <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>Arrastra imágenes o haz clic</p>
            <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>JPG, PNG, WEBP — puedes seleccionar varias</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
              style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        )}

        {/* Upload button always visible below library */}
        {imgSource === 'library' && (
          <button onClick={() => fileRef.current?.click()} style={{
            marginTop: 8, padding: '8px 16px', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text-tertiary)',
            fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={12} /> Subir imagen nueva
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
          style={{ display: 'none' }} onChange={handleFileUpload} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 2: CONFIGURE EACH IMAGE
  // ══════════════════════════════════════════════════════════════════
  if (step === 'configure') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <button onClick={() => setStep('select')} style={{
              fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <ChevronLeft size={12} /> Volver a selección
            </button>
            <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 4 }}>
              Paso 2 de 3 — Imagen {activeIdx + 1} de {slots.length}
            </p>
            <p style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
              Configura cada imagen
            </p>
          </div>
          <button onClick={() => setStep('generate')} style={{
            padding: '10px 24px', background: '#111827', color: '#ffffff', border: 'none',
            fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Continuar <ArrowRight size={13} />
          </button>
        </div>

        {/* Image strip navigation */}
        <div style={{ display: 'flex', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 20 }}>
          {slots.map((s, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} style={{
              position: 'relative', flexShrink: 0, width: 72, height: 72,
              padding: 0, border: 'none', cursor: 'pointer',
              outline: i === activeIdx ? '2px solid var(--accent)' : 'none',
              outlineOffset: -2,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: i === activeIdx ? 1 : 0.5 }} />
              <div style={{
                position: 'absolute', bottom: 2, left: 2,
                background: i === activeIdx ? 'var(--accent)' : '#111827', color: '#ffffff',
                fontFamily: fc, fontSize: 9, fontWeight: 700,
                width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              {s.inspiration && (
                <div style={{ position: 'absolute', top: 2, right: 2 }}>
                  <Flame size={10} style={{ color: 'var(--accent)' }} />
                </div>
              )}
              {s.context && (
                <div style={{ position: 'absolute', top: 2, left: 2, width: 6, height: 6, background: 'var(--accent)' }} />
              )}
            </button>
          ))}
        </div>

        {/* Active image config — 2 columns */}
        {activeSlot && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
            {/* Left: image preview */}
            <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeSlot.url} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }} />
            </div>

            {/* Right: config */}
            <div style={{ background: 'var(--bg)' }}>
              {/* Context / prompt */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Prompt / contexto para esta imagen
                </label>
                <textarea
                  value={activeSlot.context}
                  onChange={(e) => updateSlot(activeIdx, { context: e.target.value })}
                  placeholder="Ej: Post promocional del menú de verano, tono fresco y cercano..."
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px', border: '1px solid var(--border)',
                    fontFamily: f, fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                    boxSizing: 'border-box', background: 'var(--bg)', resize: 'vertical', lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Inspiration */}
              <div style={{ padding: '14px 20px' }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Inspiración
                </label>

                {activeSlot.inspiration ? (
                  <div style={{
                    padding: '10px 12px', border: '1px solid var(--accent)',
                    background: 'var(--accent-soft, rgba(15,118,110,0.08))',
                    display: 'flex', gap: 10, alignItems: 'center',
                  }}>
                    {activeSlot.inspiration.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={activeSlot.inspiration.thumbnail_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--accent)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeSlot.inspiration.title || 'Referencia guardada'}
                      </p>
                    </div>
                    <button onClick={() => updateSlot(activeIdx, { inspiration: null })} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                    }}>
                      <X size={13} style={{ color: 'var(--accent)' }} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowInspo(!showInspo)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '10px 14px', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                    transition: 'all 0.15s',
                  }}>
                    <Flame size={14} /> Elegir inspiración
                  </button>
                )}

                {/* Inspo picker grid */}
                {showInspo && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', maxHeight: 220, overflowY: 'auto' }}>
                    {loadingInspo ? (
                      <div style={{ padding: 20, textAlign: 'center' }}>
                        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Cargando...</p>
                      </div>
                    ) : inspirations.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center' }}>
                        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>No tienes inspiraciones guardadas</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)' }}>
                        {inspirations.map(inspo => (
                          <div key={inspo.id} onClick={() => {
                            updateSlot(activeIdx, { inspiration: inspo });
                            if (inspo.notes && !activeSlot.context) updateSlot(activeIdx, { context: inspo.notes, inspiration: inspo });
                            setShowInspo(false);
                          }} style={{ position: 'relative', cursor: 'pointer', background: 'var(--bg)', overflow: 'hidden' }}>
                            {inspo.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={inspo.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Flame size={16} style={{ color: 'var(--border)' }} />
                              </div>
                            )}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '16px 6px 6px' }}>
                              <p style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {inspo.title || 'Sin título'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prev / Next navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button disabled={activeIdx === 0} onClick={() => setActiveIdx(activeIdx - 1)} style={{
            padding: '8px 16px', border: '1px solid var(--border)', background: 'var(--bg)',
            color: activeIdx === 0 ? 'var(--border)' : 'var(--text-secondary)',
            fontFamily: f, fontSize: 12, fontWeight: 600, cursor: activeIdx === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <ChevronLeft size={13} /> Anterior
          </button>
          <button disabled={activeIdx >= slots.length - 1} onClick={() => setActiveIdx(activeIdx + 1)} style={{
            padding: '8px 16px', border: '1px solid var(--border)', background: 'var(--bg)',
            color: activeIdx >= slots.length - 1 ? 'var(--border)' : 'var(--text-secondary)',
            fontFamily: f, fontSize: 12, fontWeight: 600, cursor: activeIdx >= slots.length - 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Siguiente <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: COMMON SETTINGS + GENERATE + SAVE
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="post-editor">
      {/* Left: controls */}
      <div className="post-editor-controls">
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setStep('configure')} style={{
            fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <ChevronLeft size={12} /> Volver a configuración
          </button>
          <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 4 }}>
            Paso 3 de 3
          </p>
          <p style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
            Genera y publica
          </p>
        </div>

        {/* Image strip — small */}
        <div className="editor-section">
          <p className="editor-section-title">Imágenes seleccionadas ({slots.length})</p>
          <div style={{ display: 'flex', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', overflowX: 'auto', width: 'fit-content' }}>
            {slots.map((s, i) => (
              <button key={i} onClick={() => setActiveIdx(i)} style={{
                flexShrink: 0, width: 52, height: 52, padding: 0, border: 'none', cursor: 'pointer',
                outline: i === activeIdx ? '2px solid var(--accent)' : 'none', outlineOffset: -2,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: i === activeIdx ? 1 : 0.5 }} />
              </button>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div className="editor-section">
          <p className="editor-section-title">Plataformas</p>
          <div className="platform-toggles">
            <button className={`platform-toggle platform-ig ${platforms.includes('instagram') ? 'active' : ''}`} onClick={() => togglePlatform('instagram')}>Instagram</button>
            <button className={`platform-toggle platform-fb ${platforms.includes('facebook') ? 'active' : ''}`} onClick={() => togglePlatform('facebook')}>Facebook</button>
          </div>
        </div>

        {/* Format + Goal */}
        <div className="editor-section editor-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Formato</label>
            <select value={format} onChange={(e) => { const v = e.target.value as PostFormat; setFormat(v); setIsStory(v === 'story'); }}>
              {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Objetivo</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value as PostGoal)}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        </div>

        {/* AI Buttons */}
        <div className="editor-ai-row">
          <button className="btn-outline" disabled={!activeSlot || analysing} onClick={analyseImage}>
            {analysing ? <span className="loading-spinner" /> : <Wand2 size={16} />}
            {analysing ? 'Analizando...' : 'Analizar imagen'}
          </button>
          <button className="btn-primary btn-orange" disabled={!editorResult || generating} onClick={generateCopy}>
            {generating ? <span className="loading-spinner" /> : <RefreshCw size={16} />}
            {generating ? t('generating') : 'Generar copy'}
          </button>
        </div>

        {/* Analysis */}
        {editorResult && (
          <div className="editor-analysis-summary">
            <p className="analysis-label">Análisis IA</p>
            <div className="analysis-tags">
              {editorResult.visualTags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
            </div>
            {editorResult.analysis.qualityScore != null && (
              <p className="analysis-quality">
                Calidad: <strong>{editorResult.analysis.qualityScore}/10</strong>
                {editorResult.analysis.suitabilityReason && ` — ${editorResult.analysis.suitabilityReason}`}
              </p>
            )}
          </div>
        )}

        {/* Caption */}
        <div className="editor-section">
          <p className="editor-section-title">Caption</p>
          {copywriterResult && platforms.length > 1 && (
            <div className="caption-platform-tabs">
              {platforms.map(p => (
                <button key={p} className={`caption-tab ${previewPlatform === p ? 'active' : ''}`}
                  onClick={() => { setPreviewPlatform(p); if (copywriterResult.copies[p]) setCaption(copywriterResult.copies[p]!.caption); }}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <textarea className="editor-textarea caption-textarea" placeholder="Escribe o genera el caption con IA..." value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} />
          <div className="caption-meta">
            <span>{caption.length} caracteres</span>
            {copywriterResult?.callToAction && <span>CTA: {copywriterResult.callToAction}</span>}
          </div>
        </div>

        {/* Hashtags */}
        <div className="editor-section">
          <p className="editor-section-title">Hashtags</p>
          <div className="tags-input-area">
            {hashtags.map(h => (
              <span key={h} className="tag-chip">
                #{h.replace(/^#/, '')}
                <button onClick={() => setHashtags(prev => prev.filter(x => x !== h))}>x</button>
              </span>
            ))}
            <input placeholder="Añadir hashtag..." onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = e.currentTarget.value.trim().replace(/^#/, '');
                if (val && !hashtags.includes(val)) setHashtags(prev => [...prev, val]);
                e.currentTarget.value = '';
              }
            }} />
          </div>
        </div>

        {/* Story */}
        {allowStories && platforms.includes('instagram') && format !== 'story' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text)' }}>
            <input type="checkbox" checked={isStory} onChange={(e) => setIsStory(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0F766E', cursor: 'pointer' }} />
            <span>Convertir también en historia</span>
          </label>
        )}

        {error && <p className="editor-error">{error}</p>}

        <button className="btn-primary btn-full" disabled={saving || uploading || (!caption && !activeSlot)} onClick={handleSave}>
          {uploading ? 'Subiendo imagen...' : saving ? 'Guardando...' : `Guardar post${slots.length > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Right: preview */}
      <div className="post-editor-preview">
        <div className="preview-tabs">
          {platforms.map(p => (
            <button key={p} className={`preview-tab ${previewPlatform === p ? 'active' : ''}`} onClick={() => setPreviewPlatform(p)}>
              {p === 'instagram' ? 'IG' : 'FB'} {p}
            </button>
          ))}
        </div>
        <PostPreview imageUrl={activeSlot?.url ?? null} caption={caption} hashtags={hashtags} platform={previewPlatform} format={format} brandName={brandName} />
      </div>
    </div>
  );
}
