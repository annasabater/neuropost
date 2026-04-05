'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Flame, Bookmark, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Template = {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  sectors: string[];
  styles: string[];
  format: string;
  tags: string[];
  times_used: number;
};

type Reference = {
  id: string;
  type: string;
  source_url: string | null;
  thumbnail_url: string | null;
  title: string;
  notes: string | null;
  style_tags: string[] | null;
  format: string | null;
  created_at: string;
  recreation?: { id: string; status: string } | null;
};

const FORMAT_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'image', label: 'Imagen' },
  { value: 'reel', label: 'Reel' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'story', label: 'Story' },
];

const STYLE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'creatiu', label: 'Creativo' },
  { value: 'elegant', label: 'Elegante' },
  { value: 'warm', label: 'Cálido' },
  { value: 'dynamic', label: 'Dinámico' },
];

const TAG_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'producto', label: 'Producto' },
  { value: 'local', label: 'Local' },
  { value: 'promo', label: 'Promo' },
  { value: 'making-of', label: 'Making of' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'temporada', label: 'Temporada' },
  { value: 'tendencia', label: 'Tendencia' },
];

const STYLE_PILL_OPTIONS = [
  { value: 'Creativo', label: 'Creativo' },
  { value: 'Colorido', label: 'Colorido' },
  { value: 'Minimal', label: 'Minimal' },
  { value: 'Elegante', label: 'Elegante' },
  { value: 'Dinámico', label: 'Dinámico' },
];

const LIKES_OPTIONS = [
  { value: 'La composición', label: 'La composición' },
  { value: 'El color', label: 'El color' },
  { value: 'El formato', label: 'El formato' },
  { value: 'El caption', label: 'El caption' },
  { value: 'El estilo general', label: 'El estilo general' },
];

const RECREATE_STYLE_OPTIONS = [
  { value: 'composicion', label: 'Composición' },
  { value: 'color', label: 'Color' },
  { value: 'formato', label: 'Formato' },
  { value: 'caption', label: 'Caption' },
];

const FORMAT_LABEL: Record<string, string> = {
  image: 'Imagen',
  reel: 'Reel',
  carousel: 'Carrusel',
  story: 'Story',
};

const REF_TYPE_LABEL: Record<string, string> = {
  url: 'URL',
  upload: 'Subido',
  template: 'Plantilla',
};

function PillFilter({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 48 }}>
        {label}:
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 14px',
            borderRadius: 20,
            border: `1px solid ${value === opt.value ? 'var(--orange)' : 'var(--border)'}`,
            background: value === opt.value ? 'var(--orange)' : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--muted)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onSave,
  onRecreate,
}: {
  template: Template;
  onSave: (t: Template) => void;
  onRecreate: (t: Template) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 200 }}>
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
            }}
          >
            🎨
          </div>
        )}
        {/* Hover overlay */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onSave(template); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 10,
                border: '2px solid #fff',
                background: 'transparent',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <Bookmark size={14} /> Guardar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRecreate(template); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--orange)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              ✦ Recrear →
            </button>
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        {template.format && (
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              background: '#f3f4f6',
              color: '#6b7280',
              marginBottom: 6,
            }}
          >
            {FORMAT_LABEL[template.format] ?? template.format}
          </span>
        )}
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)', margin: '0 0 4px' }}>
          {template.title}
        </p>
        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--muted)',
            margin: '0 0 10px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
        {template.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {template.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: '#f3f4f6',
                  color: '#9ca3af',
                  fontWeight: 500,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceCard({
  reference,
  onRecreate,
  onDelete,
}: {
  reference: Reference;
  onRecreate: (r: Reference) => void;
  onDelete: (id: string) => void;
}) {
  const rec = reference.recreation;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail */}
      <div style={{ height: 180 }}>
        {reference.thumbnail_url ? (
          <img
            src={reference.thumbnail_url}
            alt={reference.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
            }}
          >
            {reference.type === 'url' ? '🔗' : reference.type === 'upload' ? '📁' : '🎨'}
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        {reference.type && (
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 20,
              background: '#f3f4f6',
              color: '#6b7280',
              marginBottom: 6,
            }}
          >
            {REF_TYPE_LABEL[reference.type] ?? reference.type}
          </span>
        )}
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)', margin: '0 0 4px' }}>
          {reference.title}
        </p>
        {reference.notes && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              fontStyle: 'italic',
              margin: '0 0 10px',
              lineHeight: 1.5,
            }}
          >
            {reference.notes}
          </p>
        )}

        {/* Recreation status */}
        <div style={{ marginBottom: 10 }}>
          {!rec ? (
            <button
              onClick={() => onRecreate(reference)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--orange)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              ✦ Recrear esto
            </button>
          ) : rec.status === 'completed' ? (
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Ver →
            </button>
          ) : (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--muted)',
                fontStyle: 'italic',
              }}
            >
              El equipo está en ello…
            </span>
          )}
        </div>

        <button
          onClick={() => onDelete(reference.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 7,
            border: '1px solid #fecaca',
            background: 'transparent',
            color: '#dc2626',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={12} /> Eliminar
        </button>
      </div>
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
  const [filterTag, setFilterTag] = useState('all');

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'url' | 'upload'>('url');
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addFormat, setAddFormat] = useState('image');
  const [addStyleTags, setAddStyleTags] = useState<string[]>([]);
  const [addLikes, setAddLikes] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Recreate modal
  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [recreateRef, setRecreateRef] = useState<Reference | null>(null);
  const [recreateTemplate, setRecreateTemplate] = useState<Template | null>(null);
  const [recreateNotes, setRecreateNotes] = useState('');
  const [recreateStyleToAdapt, setRecreateStyleToAdapt] = useState<string[]>([]);
  const [recreating, setRecreating] = useState(false);
  const [recreateSuccess, setRecreateSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/inspiracion/templates')
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        setLoadingTemplates(false);
      })
      .catch(() => setLoadingTemplates(false));

    fetch('/api/inspiracion/referencias')
      .then((r) => r.json())
      .then((d) => {
        setReferences(d.references ?? []);
        setLoadingRefs(false);
      })
      .catch(() => setLoadingRefs(false));
  }, []);

  // Filtered templates
  const filteredTemplates = templates.filter((t) => {
    if (filterFormat !== 'all' && t.format !== filterFormat) return false;
    if (filterStyle !== 'all' && !t.styles.includes(filterStyle)) return false;
    if (filterTag !== 'all' && !t.tags.includes(filterTag)) return false;
    return true;
  });

  function toggleStyleTag(tag: string) {
    setAddStyleTags((prev) =>
      prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]
    );
  }

  function toggleRecreateStyle(val: string) {
    setRecreateStyleToAdapt((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  }

  function openRecreateForRef(ref: Reference) {
    setRecreateRef(ref);
    setRecreateTemplate(null);
    setRecreateNotes('');
    setRecreateStyleToAdapt([]);
    setRecreateSuccess(false);
    setShowRecreateModal(true);
  }

  function openRecreateForTemplate(template: Template) {
    setRecreateTemplate(template);
    setRecreateRef(null);
    setRecreateNotes('');
    setRecreateStyleToAdapt([]);
    setRecreateSuccess(false);
    setShowRecreateModal(true);
  }

  async function saveTemplate(template: Template) {
    const res = await fetch('/api/inspiracion/referencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'template',
        title: template.title,
        thumbnail_url: template.thumbnail_url,
        format: template.format,
        style_tags: template.styles,
        notes: '',
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setReferences((prev) => [d.reference, ...prev]);
      toast.success('Guardado en tus referencias');
    } else {
      toast.error('Error al guardar');
    }
  }

  async function handleSaveReference() {
    if (!addTitle.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);

    let thumbnailUrl: string | null = null;

    if (addType === 'upload' && uploadFile) {
      // Upload via multipart/form-data
      const formData = new FormData();
      formData.append('file', uploadFile);
      const upRes = await fetch('/api/inspiracion/upload', { method: 'POST', body: formData });
      if (upRes.ok) {
        const upData = await upRes.json();
        thumbnailUrl = upData.url ?? null;
      }
    }

    const payload = {
      type: addType,
      source_url: addType === 'url' ? (addUrl || null) : null,
      thumbnail_url: thumbnailUrl,
      title: addTitle,
      notes: addNotes || null,
      format: addFormat || null,
      style_tags: addStyleTags.length > 0 ? addStyleTags : null,
    };

    const res = await fetch('/api/inspiracion/referencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const d = await res.json();
      setReferences((prev) => [d.reference, ...prev]);
      setShowAddModal(false);
      resetAddForm();
      toast.success('Referencia guardada');
    } else {
      toast.error('Error al guardar la referencia');
    }
    setSaving(false);
  }

  function resetAddForm() {
    setAddType('url');
    setAddUrl('');
    setAddTitle('');
    setAddNotes('');
    setAddFormat('image');
    setAddStyleTags([]);
    setAddLikes([]);
    setUploadFile(null);
  }

  async function handleRecreate() {
    if (!recreateNotes.trim()) { toast.error('Describe qué quieres mostrar'); return; }
    setRecreating(true);

    let refId: string | null = recreateRef?.id ?? null;

    // If coming from a template, first save as reference
    if (recreateTemplate && !recreateRef) {
      const saveRes = await fetch('/api/inspiracion/referencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'template',
          title: recreateTemplate.title,
          thumbnail_url: recreateTemplate.thumbnail_url,
          format: recreateTemplate.format,
          style_tags: recreateTemplate.styles,
          notes: '',
        }),
      });
      if (saveRes.ok) {
        const sd = await saveRes.json();
        refId = sd.reference?.id ?? null;
        if (sd.reference) setReferences((prev) => [sd.reference, ...prev]);
      }
    }

    if (!refId) { toast.error('Error al procesar la referencia'); setRecreating(false); return; }

    const res = await fetch('/api/inspiracion/recrear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_id: refId,
        client_notes: recreateNotes,
        style_to_adapt: recreateStyleToAdapt,
      }),
    });

    if (res.ok) {
      setRecreateSuccess(true);
      // Update references list with recreation status
      const d = await res.json();
      if (d.recreation) {
        setReferences((prev) =>
          prev.map((r) =>
            r.id === refId ? { ...r, recreation: { id: d.recreation.id, status: d.recreation.status } } : r
          )
        );
      }
      setTimeout(() => {
        setShowRecreateModal(false);
        setRecreateSuccess(false);
        setRecreating(false);
      }, 2000);
    } else {
      toast.error('Error al enviar la solicitud');
      setRecreating(false);
    }
  }

  async function handleDeleteRef(id: string) {
    const res = await fetch(`/api/inspiracion/referencias/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setReferences((prev) => prev.filter((r) => r.id !== id));
      toast.success('Referencia eliminada');
    } else {
      toast.error('Error al eliminar');
    }
  }

  const modalTitle = recreateTemplate
    ? `Recrear: ${recreateTemplate.title}`
    : recreateRef
    ? `Recrear: ${recreateRef.title}`
    : 'Recrear';

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Inspiración</h1>
          <p className="page-sub">Encuentra el estilo perfecto para tu negocio</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: 'var(--orange)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Añadir referencia
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => setTab('explore')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: tab === 'explore' ? 700 : 400,
            color: tab === 'explore' ? 'var(--orange)' : 'var(--muted)',
            borderBottom: tab === 'explore' ? '2px solid var(--orange)' : '2px solid transparent',
          }}
        >
          <Flame size={15} /> Explorar ideas
        </button>
        <button
          onClick={() => setTab('saved')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: tab === 'saved' ? 700 : 400,
            color: tab === 'saved' ? 'var(--orange)' : 'var(--muted)',
            borderBottom: tab === 'saved' ? '2px solid var(--orange)' : '2px solid transparent',
          }}
        >
          💾 Mis referencias ({references.length})
        </button>
      </div>

      {/* TAB: Explorar */}
      {tab === 'explore' && (
        <>
          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 24,
              overflowX: 'auto',
            }}
          >
            <PillFilter
              label="Formato"
              options={FORMAT_OPTIONS}
              value={filterFormat}
              onChange={setFilterFormat}
            />
            <PillFilter
              label="Estilo"
              options={STYLE_OPTIONS}
              value={filterStyle}
              onChange={setFilterStyle}
            />
            <PillFilter
              label="Tema"
              options={TAG_OPTIONS}
              value={filterTag}
              onChange={setFilterTag}
            />
          </div>

          {loadingTemplates ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Cargando plantillas…</p>
          ) : filteredTemplates.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                color: 'var(--muted)',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
              <p style={{ fontWeight: 600 }}>No hay plantillas para estos filtros</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}
            >
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSave={saveTemplate}
                  onRecreate={openRecreateForTemplate}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB: Mis referencias */}
      {tab === 'saved' && (
        <>
          {loadingRefs ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Cargando referencias…</p>
          ) : references.length === 0 ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '48px 32px',
                textAlign: 'center',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'var(--ink)',
                  marginBottom: 8,
                }}
              >
                Aún no tienes referencias guardadas
              </p>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Explora ideas y guárdalas aquí, o añade tus propias referencias de Instagram.
              </p>
              <button
                onClick={() => setTab('explore')}
                style={{
                  padding: '10px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--orange)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Explorar ideas →
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}
            >
              {references.map((ref) => (
                <ReferenceCard
                  key={ref.id}
                  reference={ref}
                  onRecreate={openRecreateForRef}
                  onDelete={handleDeleteRef}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL: Añadir referencia */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 28,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ink)' }}>
                Añadir referencia
              </h2>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                marginBottom: 20,
                borderBottom: '1px solid var(--border)',
              }}
            >
              {([
                { key: 'url', label: '🔗 Pegar URL' },
                { key: 'upload', label: '📁 Subir imagen' },
              ] as { key: 'url' | 'upload'; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAddType(key)}
                  style={{
                    padding: '7px 16px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.83rem',
                    fontWeight: addType === key ? 700 : 400,
                    color: addType === key ? 'var(--orange)' : 'var(--muted)',
                    borderBottom: addType === key ? '2px solid var(--orange)' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {addType === 'url' && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    marginBottom: 6,
                    color: 'var(--ink)',
                  }}
                >
                  URL del post de referencia (Instagram, TikTok...)
                </label>
                <input
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                  }}
                />
              </div>
            )}

            {addType === 'upload' && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    marginBottom: 6,
                    color: 'var(--ink)',
                  }}
                >
                  Selecciona una imagen
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  marginBottom: 6,
                  color: 'var(--ink)',
                }}
              >
                ¿Cómo quieres llamar a esta referencia?
              </label>
              <input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Ej: Post de verano con producto estrella"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  marginBottom: 6,
                  color: 'var(--ink)',
                }}
              >
                ¿Qué te gusta de este contenido?
              </label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Describe qué te llama la atención…"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: '0.88rem',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {LIKES_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.78rem',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addLikes.includes(opt.value)}
                      onChange={() =>
                        setAddLikes((prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((l) => l !== opt.value)
                            : [...prev, opt.value]
                        )
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  marginBottom: 6,
                  color: 'var(--ink)',
                }}
              >
                Formato
              </label>
              <select
                value={addFormat}
                onChange={(e) => setAddFormat(e.target.value)}
                style={{
                  padding: '9px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: '0.88rem',
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                <option value="image">Imagen</option>
                <option value="reel">Reel</option>
                <option value="carousel">Carrusel</option>
                <option value="story">Story</option>
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  marginBottom: 8,
                  color: 'var(--ink)',
                }}
              >
                Estilo
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STYLE_PILL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStyleTag(opt.value)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: `1px solid ${addStyleTags.includes(opt.value) ? 'var(--orange)' : 'var(--border)'}`,
                      background: addStyleTags.includes(opt.value) ? 'var(--orange)' : 'transparent',
                      color: addStyleTags.includes(opt.value) ? '#fff' : 'var(--muted)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReference}
                disabled={saving}
                style={{
                  flex: 2,
                  padding: '12px',
                  border: 'none',
                  borderRadius: 10,
                  background: 'var(--orange)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                }}
              >
                {saving ? 'Guardando…' : 'Guardar referencia →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Recrear */}
      {showRecreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 28,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  flex: 1,
                  marginRight: 12,
                }}
              >
                {modalTitle}
              </h2>
              <button
                onClick={() => setShowRecreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {recreateSuccess ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px 0',
                  color: '#065f46',
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Solicitud enviada — el equipo se pondrá en marcha
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      marginBottom: 6,
                      color: 'var(--ink)',
                    }}
                  >
                    ¿Qué producto o momento quieres mostrar?
                  </label>
                  <textarea
                    value={recreateNotes}
                    onChange={(e) => setRecreateNotes(e.target.value)}
                    placeholder="Describe lo que quieres recrear, el contexto, el producto…"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: '0.88rem',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      marginBottom: 10,
                      color: 'var(--ink)',
                    }}
                  >
                    Aspectos a adaptar
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {RECREATE_STYLE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.82rem',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={recreateStyleToAdapt.includes(opt.value)}
                          onChange={() => toggleRecreateStyle(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setShowRecreateModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRecreate}
                    disabled={recreating}
                    style={{
                      flex: 2,
                      padding: '12px',
                      border: 'none',
                      borderRadius: 10,
                      background: 'var(--orange)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                    }}
                  >
                    {recreating ? 'Enviando…' : '✦ Enviar solicitud →'}
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
