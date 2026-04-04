'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Wand2, RefreshCw } from 'lucide-react';
import type { Platform, PostFormat, PostGoal, EditorOutput, CopywriterOutput } from '@/types';
import { PostPreview } from './PostPreview';
import { createBrowserClient } from '@/lib/supabase';

interface Props {
  brandName:     string;
  allowStories?: boolean; // true if plan supports stories
  onSave: (data: {
    imageUrl:       string | null;
    caption:        string;
    hashtags:       string[];
    platforms:      Platform[];
    format:         PostFormat;
    goal:           PostGoal;
    aiExplanation?: string;
    qualityScore?:  number;
    isStory?:       boolean;
  }) => Promise<void>;
}

const FORMATS: { value: PostFormat; label: string }[] = [
  { value: 'image',    label: 'Imagen' },
  { value: 'reel',     label: 'Reel' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'story',    label: 'Story' },
];

const GOALS: { value: PostGoal; label: string }[] = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'awareness',  label: 'Awareness' },
  { value: 'promotion',  label: 'Promoción' },
  { value: 'community',  label: 'Comunidad' },
];

export function PostEditor({ brandName, allowStories = false, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageUrl,   setImageUrl]   = useState<string | null>(null);
  const [imageB64,   setImageB64]   = useState<string | null>(null);
  const [imageMime,  setImageMime]  = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [caption,    setCaption]    = useState('');
  const [hashtags,   setHashtags]   = useState<string[]>([]);
  const [platforms,  setPlatforms]  = useState<Platform[]>(['instagram']);
  const [format,     setFormat]     = useState<PostFormat>('image');
  const [goal,       setGoal]       = useState<PostGoal>('engagement');
  const [context,    setContext]     = useState('');
  const [previewPlatform, setPreviewPlatform] = useState<Platform>('instagram');

  const [editorResult,     setEditorResult]     = useState<EditorOutput | null>(null);
  const [copywriterResult, setCopywriterResult] = useState<CopywriterOutput | null>(null);

  const [isStory,    setIsStory]    = useState(false);
  const [analysing,  setAnalysing]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Revoke blob URL when imageUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
    setImageMime(mime);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Strip the data URL prefix
      setImageB64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
    // Reset previous results
    setEditorResult(null);
    setCopywriterResult(null);
    setCaption('');
    setHashtags([]);
  }

  async function analyseImage() {
    if (!imageB64) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageB64,
          imageType: 'base64',
          mimeType: imageMime,
          editingLevel: 1,
          photoContext: context || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error al analizar imagen');
      setEditorResult(json.data as EditorOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalysing(false);
    }
  }

  async function generateCopy() {
    if (!editorResult) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/copywriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualTags:    editorResult.visualTags,
          imageAnalysis: editorResult.analysis,
          goal,
          platforms,
          postContext:   context || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Error al generar copy');
      const data = json.data as CopywriterOutput;
      setCopywriterResult(data);
      // Auto-fill caption from primary platform
      const primary = platforms[0];
      if (data.copies[primary]) setCaption(data.copies[primary]!.caption);
      const all = [...data.hashtags.branded, ...data.hashtags.niche, ...data.hashtags.broad];
      setHashtags(all.slice(0, 15));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let finalImageUrl = imageUrl;
      if (imageB64 && imageUrl?.startsWith('blob:')) {
        setUploading(true);
        try {
          const supabase = createBrowserClient();
          const ext = imageMime.split('/')[1] ?? 'jpg';
          const path = `${crypto.randomUUID()}.${ext}`;
          const byteString = atob(imageB64);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          const blob = new Blob([ab], { type: imageMime });
          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(path, blob, { contentType: imageMime });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          finalImageUrl = publicUrl;
        } finally {
          setUploading(false);
        }
      }

      await onSave({
        imageUrl: finalImageUrl,
        caption,
        hashtags,
        platforms,
        format,
        goal,
        aiExplanation: editorResult?.editingNarrative ?? undefined,
        qualityScore:  editorResult?.analysis.qualityScore,
        isStory: isStory && platforms.includes('instagram'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? (prev.length > 1 ? prev.filter((x) => x !== p) : prev) : [...prev, p],
    );
  }

  return (
    <div className="post-editor">
      {/* Left: editor controls */}
      <div className="post-editor-controls">
        {/* Image upload */}
        <div className="editor-section">
          <p className="editor-section-title">Imagen</p>
          <div
            className={`image-dropzone ${imageUrl ? 'has-image' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Imagen seleccionada" className="image-dropzone-preview" />
            ) : (
              <>
                <Upload size={28} className="dropzone-icon" />
                <p>Arrastra una imagen o haz clic</p>
                <span>JPG, PNG, WEBP</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {imageUrl && (
            <button className="btn-outline" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
              Cambiar imagen
            </button>
          )}
        </div>

        {/* Context */}
        <div className="editor-section">
          <p className="editor-section-title">Contexto (opcional)</p>
          <textarea
            className="editor-textarea"
            placeholder="Describe el contenido o la promoción…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
          />
        </div>

        {/* Platforms */}
        <div className="editor-section">
          <p className="editor-section-title">Plataformas</p>
          <div className="platform-toggles">
            <button
              className={`platform-toggle platform-ig ${platforms.includes('instagram') ? 'active' : ''}`}
              onClick={() => togglePlatform('instagram')}
            >
              📸 Instagram
            </button>
            <button
              className={`platform-toggle platform-fb ${platforms.includes('facebook') ? 'active' : ''}`}
              onClick={() => togglePlatform('facebook')}
            >
              📘 Facebook
            </button>
          </div>
        </div>

        {/* Format + Goal */}
        <div className="editor-section editor-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Formato</label>
            <select
              value={format}
              onChange={(e) => {
                const val = e.target.value as PostFormat;
                setFormat(val);
                if (val === 'story') setIsStory(true);
                else setIsStory(false);
              }}
            >
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

        {/* Story notice */}
        {format === 'story' && (
          <div style={{
            padding:      '10px 14px',
            borderRadius: 10,
            background:   'var(--orange-light, #fff7ed)',
            border:       '1px solid var(--orange)',
            fontSize:     '0.83rem',
            color:        'var(--ink)',
            lineHeight:   1.5,
          }}>
            <strong style={{ color: 'var(--orange)' }}>Story seleccionada.</strong>{' '}
            Las Stories duran 24h y no llevan caption. Solo imagen o video.
          </div>
        )}

        {/* AI Buttons */}
        <div className="editor-ai-row">
          <button
            className="btn-outline"
            disabled={!imageB64 || analysing}
            onClick={analyseImage}
          >
            {analysing ? <span className="loading-spinner" /> : <Wand2 size={16} />}
            {analysing ? 'Analizando…' : 'Analizar imagen'}
          </button>
          <button
            className="btn-primary btn-orange"
            disabled={!editorResult || generating}
            onClick={generateCopy}
          >
            {generating ? <span className="loading-spinner" /> : <RefreshCw size={16} />}
            {generating ? 'Generando…' : 'Generar copy'}
          </button>
        </div>

        {/* Image analysis summary */}
        {editorResult && (
          <div className="editor-analysis-summary">
            <p className="analysis-label">Análisis IA</p>
            <div className="analysis-tags">
              {editorResult.visualTags.map((t) => (
                <span key={t} className="tag-chip">{t}</span>
              ))}
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
              {platforms.map((p) => (
                <button
                  key={p}
                  className={`caption-tab ${previewPlatform === p ? 'active' : ''}`}
                  onClick={() => {
                    setPreviewPlatform(p);
                    if (copywriterResult.copies[p]) setCaption(copywriterResult.copies[p]!.caption);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="editor-textarea caption-textarea"
            placeholder="Escribe o genera el caption con IA…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={5}
          />
          <div className="caption-meta">
            <span>{caption.length} caracteres</span>
            {copywriterResult?.callToAction && (
              <span>CTA: {copywriterResult.callToAction}</span>
            )}
          </div>
        </div>

        {/* Hashtags */}
        <div className="editor-section">
          <p className="editor-section-title">Hashtags</p>
          <div className="tags-input-area">
            {hashtags.map((h) => (
              <span key={h} className="tag-chip">
                #{h.replace(/^#/, '')}
                <button onClick={() => setHashtags((prev) => prev.filter((x) => x !== h))}>×</button>
              </span>
            ))}
            <input
              placeholder="Añadir hashtag…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const val = e.currentTarget.value.trim().replace(/^#/, '');
                  if (val && !hashtags.includes(val)) setHashtags((prev) => [...prev, val]);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        </div>

        {/* Story option — only if plan allows, Instagram selected, and format is not already story */}
        {allowStories && platforms.includes('instagram') && format !== 'story' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={isStory}
              onChange={(e) => setIsStory(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--orange)', cursor: 'pointer' }}
            />
            <span>📱 Convertir también en historia</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>(formato 9:16)</span>
          </label>
        )}

        {error && <p className="editor-error">{error}</p>}

        <button
          className="btn-primary btn-full"
          disabled={saving || uploading || (!caption && !imageUrl)}
          onClick={handleSave}
        >
          {uploading ? 'Subiendo imagen...' : saving ? 'Guardando…' : 'Guardar post'}
        </button>
      </div>

      {/* Right: preview */}
      <div className="post-editor-preview">
        <div className="preview-tabs">
          {platforms.map((p) => (
            <button
              key={p}
              className={`preview-tab ${previewPlatform === p ? 'active' : ''}`}
              onClick={() => setPreviewPlatform(p)}
            >
              {p === 'instagram' ? '📸' : '📘'} {p}
            </button>
          ))}
        </div>
        <PostPreview
          imageUrl={imageUrl}
          caption={caption}
          hashtags={hashtags}
          platform={previewPlatform}
          format={format}
          brandName={brandName}
        />
      </div>
    </div>
  );
}
