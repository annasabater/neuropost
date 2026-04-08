'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

const FORMAT_OPTIONS = ['all', 'image', 'reel', 'carousel', 'story'];
const FORMAT_LABEL: Record<string, string> = { all: 'Todos', image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', story: 'Story' };
const STYLE_OPTIONS = ['all', 'creatiu', 'elegant', 'warm', 'dynamic'];
const STYLE_LABEL: Record<string, string> = { all: 'Todos', creatiu: 'Creativo', elegant: 'Elegante', warm: 'Cálido', dynamic: 'Dinámico' };

function InspirationCard({ image, title, description, format, tags, onSave, onRecreate }: {
  image: string | null; title: string; description: string; format?: string;
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
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', padding: '40px 14px 14px' }}>
        <p style={{ fontFamily: fc, fontSize: 15, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1.2, marginBottom: 4 }}>{title}</p>
        {description && <p style={{ fontFamily: f, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</p>}
        {tags && tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {tags.slice(0, 3).map((tag) => <span key={tag} style={{ fontFamily: f, fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#{tag}</span>)}
          </div>
        )}
      </div>
      {hovered && (onSave || onRecreate) && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {onSave && <button onClick={(e) => { e.stopPropagation(); onSave(); }} style={{ padding: '8px 20px', border: '1px solid #fff', background: 'transparent', color: '#fff', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Guardar</button>}
          {onRecreate && <button onClick={(e) => { e.stopPropagation(); onRecreate(); }} style={{ padding: '8px 20px', border: 'none', background: '#fff', color: '#111', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>Recrear →</button>}
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
  const [filterStyle, setFilterStyle] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'url' | 'upload'>('url');
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addFormat, setAddFormat] = useState('image');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [recreateTitle, setRecreateTitle] = useState('');
  const [recreateRefId, setRecreateRefId] = useState<string | null>(null);
  const [recreateSourceTemplate, setRecreateSourceTemplate] = useState<Template | null>(null);
  const [recreateNotes, setRecreateNotes] = useState('');
  const [recreating, setRecreating] = useState(false);
  const [recreateSuccess, setRecreateSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/inspiracion/templates').then(r => r.json()).then(d => { setTemplates(d.templates ?? []); setLoadingTemplates(false); }).catch(() => setLoadingTemplates(false));
    fetch('/api/inspiracion/referencias').then(r => r.json()).then(d => { setReferences(d.references ?? []); setLoadingRefs(false); }).catch(() => setLoadingRefs(false));
  }, []);

  const filteredTemplates = templates.filter(t => {
    if (filterFormat !== 'all' && t.format !== filterFormat) return false;
    if (filterStyle !== 'all' && !t.styles.includes(filterStyle)) return false;
    return true;
  });

  async function saveTemplate(template: Template) {
    const res = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: template.title, thumbnail_url: template.thumbnail_url, format: template.format, style_tags: template.styles, notes: '' }) });
    if (res.ok) { const d = await res.json(); setReferences(p => [d.reference, ...p]); toast.success('Guardado'); } else toast.error('Error');
  }

  function openRecreateForTemplate(t: Template) { setRecreateSourceTemplate(t); setRecreateRefId(null); setRecreateTitle(t.title); setRecreateNotes(''); setRecreateSuccess(false); setShowRecreateModal(true); }
  function openRecreateForRef(r: Reference) { setRecreateSourceTemplate(null); setRecreateRefId(r.id); setRecreateTitle(r.title); setRecreateNotes(''); setRecreateSuccess(false); setShowRecreateModal(true); }

  async function handleSaveReference() {
    if (!addTitle.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);
    let thumbnailUrl: string | null = null;
    if (addType === 'upload' && uploadFile) { const fd = new FormData(); fd.append('file', uploadFile); const up = await fetch('/api/inspiracion/upload', { method: 'POST', body: fd }); if (up.ok) { const d = await up.json(); thumbnailUrl = d.url ?? null; } }
    const res = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: addType, source_url: addType === 'url' ? (addUrl || null) : null, thumbnail_url: thumbnailUrl, title: addTitle, notes: addNotes || null, format: addFormat || null }) });
    if (res.ok) { const d = await res.json(); setReferences(p => [d.reference, ...p]); setShowAddModal(false); resetAddForm(); toast.success('Guardada'); } else toast.error('Error');
    setSaving(false);
  }

  function resetAddForm() { setAddType('url'); setAddUrl(''); setAddTitle(''); setAddNotes(''); setAddFormat('image'); setUploadFile(null); }

  async function handleRecreate() {
    if (!recreateNotes.trim()) { toast.error('Describe qué quieres'); return; }
    setRecreating(true);
    let refId = recreateRefId;
    if (recreateSourceTemplate && !refId) {
      const sr = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: recreateSourceTemplate.title, thumbnail_url: recreateSourceTemplate.thumbnail_url, format: recreateSourceTemplate.format, style_tags: recreateSourceTemplate.styles, notes: '' }) });
      if (sr.ok) { const sd = await sr.json(); refId = sd.reference?.id ?? null; if (sd.reference) setReferences(p => [sd.reference, ...p]); }
    }
    if (!refId) { toast.error('Error'); setRecreating(false); return; }
    const res = await fetch('/api/inspiracion/recrear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference_id: refId, client_notes: recreateNotes, style_to_adapt: [] }) });
    if (res.ok) { setRecreateSuccess(true); const d = await res.json(); if (d.recreation) setReferences(p => p.map(r => r.id === refId ? { ...r, recreation: { id: d.recreation.id, status: d.recreation.status } } : r)); setTimeout(() => { setShowRecreateModal(false); setRecreateSuccess(false); setRecreating(false); }, 2000); }
    else { toast.error('Error'); setRecreating(false); }
  }

  async function handleDeleteRef(id: string) { const res = await fetch(`/api/inspiracion/referencias/${id}`, { method: 'DELETE' }); if (res.ok) { setReferences(p => p.filter(r => r.id !== id)); toast.success('Eliminada'); } else toast.error('Error'); }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      <div style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12 }}>Inspiración</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>Encuentra el estilo perfecto para tu negocio</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '10px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Plus size={14} /> Añadir referencia
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['explore', 'saved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 12, fontFamily: fc, fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: tab === t ? '2px solid var(--text-primary)' : '2px solid transparent', transition: 'all 0.15s' }}>
            {t === 'explore' ? 'Explorar' : `Guardadas (${references.length})`}
          </button>
        ))}
      </div>

      {tab === 'explore' && (
        <>
          <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>Formato</span>
              {FORMAT_OPTIONS.map(v => <button key={v} onClick={() => setFilterFormat(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: f, fontSize: 13, fontWeight: 500, color: filterFormat === v ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: filterFormat === v ? '1px solid var(--text-primary)' : '1px solid transparent', paddingBottom: 2, transition: 'all 0.15s' }}>{FORMAT_LABEL[v]}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>Estilo</span>
              {STYLE_OPTIONS.map(v => <button key={v} onClick={() => setFilterStyle(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: f, fontSize: 13, fontWeight: 500, color: filterStyle === v ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: filterStyle === v ? '1px solid var(--text-primary)' : '1px solid transparent', paddingBottom: 2, transition: 'all 0.15s' }}>{STYLE_LABEL[v]}</button>)}
            </div>
          </div>

          {loadingTemplates ? <p style={{ color: 'var(--text-tertiary)', fontFamily: f }}>Cargando...</p>
          : filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin resultados</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f }}>Prueba con otros filtros</p>
            </div>
          ) : (
            <div style={{ columns: '3 260px', gap: 2 }}>
              {filteredTemplates.map(t => <InspirationCard key={t.id} image={t.thumbnail_url} title={t.title} description={t.description} format={t.format} tags={t.tags} onSave={() => saveTemplate(t)} onRecreate={() => openRecreateForTemplate(t)} />)}
            </div>
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
            <div style={{ columns: '3 260px', gap: 2 }}>
              {references.map(ref => (
                <div key={ref.id} style={{ position: 'relative', breakInside: 'avoid', marginBottom: 2 }}>
                  <InspirationCard image={ref.thumbnail_url} title={ref.title} description={ref.notes ?? ''} format={ref.format ?? undefined} onRecreate={ref.recreation ? undefined : () => openRecreateForRef(ref)} />
                  <button onClick={() => handleDeleteRef(ref.id)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', padding: '4px 6px', cursor: 'pointer' }}><Trash2 size={12} /></button>
                  {ref.recreation && <div style={{ position: 'absolute', top: 8, left: 8, background: ref.recreation.status === 'completed' ? 'var(--accent)' : 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ref.recreation.status === 'completed' ? 'Recreado' : 'En proceso'}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Add */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Añadir referencia</h2>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', marginBottom: 24 }}>
              {(['url', 'upload'] as const).map(t => <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: 8, border: 'none', cursor: 'pointer', background: addType === t ? 'var(--text-primary)' : 'var(--bg)', color: addType === t ? 'var(--bg)' : 'var(--text-tertiary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t === 'url' ? 'Pegar URL' : 'Subir imagen'}</button>)}
            </div>
            {addType === 'url' && <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>URL</label><input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://instagram.com/p/..." style={inputStyle} /></div>}
            {addType === 'upload' && <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Imagen</label><input ref={fileInputRef} type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={inputStyle} /></div>}
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Título</label><input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Ej: Post de verano" style={inputStyle} /></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Notas</label><textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Qué te gusta..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            <div style={{ marginBottom: 24 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Formato</label><select value={addFormat} onChange={e => setAddFormat(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}><option value="image">Imagen</option><option value="reel">Reel</option><option value="carousel">Carrusel</option><option value="story">Story</option></select></div>
            <div style={{ display: 'flex', gap: 1 }}>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveReference} disabled={saving} style={{ flex: 2, padding: 12, border: 'none', background: 'var(--text-primary)', color: 'var(--bg)', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Guardando...' : 'Guardar →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recreate */}
      {showRecreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', flex: 1 }}>Recrear: {recreateTitle}</h2>
              <button onClick={() => setShowRecreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            {recreateSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ Enviado</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo se pondrá en marcha</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}><label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>¿Qué producto o momento quieres mostrar?</label><textarea value={recreateNotes} onChange={e => setRecreateNotes(e.target.value)} placeholder="Describe lo que quieres recrear..." rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></div>
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
  );
}
