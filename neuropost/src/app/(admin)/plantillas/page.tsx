'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

type Template = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  sectors: string[]; styles: string[]; format: string | null; prompt_template: string | null;
  tags: string[]; is_active: boolean; times_used: number; created_at: string;
};

const A = {
  bg:     '#0f0e0c',
  card:   '#1a1917',
  border: '#2a2927',
  orange: '#ff6b35',
  muted:  '#666',
  text:   '#e8e3db',
};

const FORMATS = ['imagen', 'reel', 'carousel', 'story'];

function emptyForm() {
  return {
    fTitle: '', fDescription: '', fThumbnailUrl: '',
    fSectors: '', fStyles: '', fFormat: 'imagen',
    fPromptTemplate: '', fTags: '',
  };
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Template | null>(null);
  const [saving, setSaving]       = useState(false);

  const [fTitle, setFTitle]                   = useState('');
  const [fDescription, setFDescription]       = useState('');
  const [fThumbnailUrl, setFThumbnailUrl]     = useState('');
  const [fSectors, setFSectors]               = useState('');
  const [fStyles, setFStyles]                 = useState('');
  const [fFormat, setFFormat]                 = useState('imagen');
  const [fPromptTemplate, setFPromptTemplate] = useState('');
  const [fTags, setFTags]                     = useState('');

  useEffect(() => {
    fetch('/api/admin/plantillas')
      .then((r) => r.json())
      .then((d) => { setTemplates(d.templates ?? []); setLoading(false); });
  }, []);

  function openCreate() {
    setEditing(null);
    const f = emptyForm();
    setFTitle(f.fTitle); setFDescription(f.fDescription); setFThumbnailUrl(f.fThumbnailUrl);
    setFSectors(f.fSectors); setFStyles(f.fStyles); setFFormat(f.fFormat);
    setFPromptTemplate(f.fPromptTemplate); setFTags(f.fTags);
    setShowModal(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setFTitle(t.title);
    setFDescription(t.description ?? '');
    setFThumbnailUrl(t.thumbnail_url ?? '');
    setFSectors((t.sectors ?? []).join(', '));
    setFStyles((t.styles ?? []).join(', '));
    setFFormat(t.format ?? 'imagen');
    setFPromptTemplate(t.prompt_template ?? '');
    setFTags((t.tags ?? []).join(', '));
    setShowModal(true);
  }

  function splitCsv(s: string): string[] {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }

  async function handleSave() {
    if (!fTitle.trim()) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    const body = {
      title: fTitle.trim(),
      description: fDescription.trim() || null,
      thumbnail_url: fThumbnailUrl.trim() || null,
      sectors: splitCsv(fSectors),
      styles: splitCsv(fStyles),
      format: fFormat || null,
      prompt_template: fPromptTemplate.trim() || null,
      tags: splitCsv(fTags),
    };
    try {
      const url    = editing ? `/api/admin/plantillas/${editing.id}` : '/api/admin/plantillas';
      const method = editing ? 'PATCH' : 'POST';
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error'); return; }
      if (editing) {
        setTemplates((prev) => prev.map((t) => t.id === editing.id ? data.template : t));
        toast.success('Plantilla actualizada');
      } else {
        setTemplates((prev) => [data.template, ...prev]);
        toast.success('Plantilla creada');
      }
      setShowModal(false);
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Template) {
    const res  = await fetch(`/api/admin/plantillas/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    const data = await res.json();
    if (res.ok) {
      setTemplates((prev) => prev.map((x) => x.id === t.id ? data.template : x));
      toast.success(data.template.is_active ? 'Activada' : 'Desactivada');
    } else {
      toast.error(data.error ?? 'Error');
    }
  }

  const totalActive   = templates.filter((t) => t.is_active).length;
  const totalInactive = templates.filter((t) => !t.is_active).length;
  const totalUsed     = templates.reduce((s, t) => s + (t.times_used ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#111', border: `1px solid ${A.border}`,
    borderRadius: 8, fontSize: 13, color: A.text, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: A.muted, marginBottom: 5 };

  return (
    <div style={{ padding: '32px 40px', color: A.text, fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: A.bg }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: 0 }}>Biblioteca de plantillas</h1>
          <p style={{ fontSize: 13, color: A.muted, marginTop: 4 }}>Gestión de la biblioteca de inspiración</p>
        </div>
        <button
          onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: A.orange, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          <Plus size={14} /> Nueva plantilla
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Activas',       value: totalActive   },
          { label: 'Inactivas',     value: totalInactive },
          { label: 'Veces usadas',  value: totalUsed     },
        ].map((stat) => (
          <div key={stat.label} style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 10, padding: '14px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: A.text }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: A.muted, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: A.muted, fontSize: 13 }}>Cargando...</p>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: A.muted }}>
          <div style={{ fontSize: 40 }}>🖼</div>
          <div style={{ marginTop: 12 }}>Sin plantillas. Crea la primera.</div>
        </div>
      ) : (
        <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                {['Thumbnail', 'Título', 'Sectores', 'Formato', 'Activa', 'Veces usada', 'Acciones'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: A.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${A.border}` }}>
                  {/* Thumbnail */}
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: A.border, overflow: 'hidden', flexShrink: 0 }}>
                      {t.thumbnail_url
                        ? <img src={t.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🖼</div>
                      }
                    </div>
                  </td>
                  {/* Title */}
                  <td style={{ padding: '10px 16px', color: A.text, fontWeight: 600, maxWidth: 180 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 11, color: A.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                  </td>
                  {/* Sectors */}
                  <td style={{ padding: '10px 16px', color: A.muted }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(t.sectors ?? []).slice(0, 3).map((s) => (
                        <span key={s} style={{ fontSize: 11, padding: '2px 7px', background: 'rgba(255,107,53,0.1)', color: A.orange, borderRadius: 20 }}>{s}</span>
                      ))}
                      {(t.sectors ?? []).length > 3 && <span style={{ fontSize: 11, color: A.muted }}>+{t.sectors.length - 3}</span>}
                    </div>
                  </td>
                  {/* Format */}
                  <td style={{ padding: '10px 16px', color: A.muted }}>{t.format ?? '—'}</td>
                  {/* Active toggle */}
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      onClick={() => toggleActive(t)}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: t.is_active ? '#14B8A6' : A.border,
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: t.is_active ? 18 : 3,
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </td>
                  {/* Times used */}
                  <td style={{ padding: '10px 16px', color: A.text, fontWeight: 600 }}>{t.times_used ?? 0}</td>
                  {/* Actions */}
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openEdit(t)}
                        style={{ padding: '5px 12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActive(t)}
                        style={{ padding: '5px 12px', background: t.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(20,184,166,0.08)', color: t.is_active ? '#ef4444' : '#14B8A6', border: `1px solid ${t.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(20,184,166,0.2)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        {t.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1a1917', border: `1px solid ${A.border}`, borderRadius: 14, padding: 28, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: A.text, margin: 0 }}>{editing ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                title="Cerrar modal"
                aria-label="Cerrar modal"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: A.muted }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Título */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Título *</label>
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} style={inputStyle} />
            </div>

            {/* Descripción */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Descripción</label>
              <textarea value={fDescription} onChange={(e) => setFDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* URL thumbnail */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>URL del thumbnail</label>
              <input value={fThumbnailUrl} onChange={(e) => setFThumbnailUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>

            {/* Sectores */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Sectores (separados por coma)</label>
              <input value={fSectors} onChange={(e) => setFSectors(e.target.value)} placeholder="gastronomia, belleza, fitness" style={inputStyle} />
            </div>

            {/* Estilos */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Estilos (separados por coma)</label>
              <input value={fStyles} onChange={(e) => setFStyles(e.target.value)} placeholder="minimal, elegant, colorit" style={inputStyle} />
            </div>

            {/* Formato */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Formato</label>
              <select value={fFormat} onChange={(e) => setFFormat(e.target.value)} style={{ ...inputStyle }}>
                {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Prompt template */}
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Prompt template</label>
              <textarea
                value={fPromptTemplate}
                onChange={(e) => setFPromptTemplate(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              />
              <div style={{ fontSize: 11, color: A.muted, marginTop: 5 }}>
                Usa <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>{'{producto}'}</code>, <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>{'{marca}'}</code>, <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>{'{color}'}</code>, <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>{'{estilo}'}</code>, <code style={{ background: '#111', padding: '1px 5px', borderRadius: 4 }}>{'{sector}'}</code> como variables
              </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Tags (separados por coma)</label>
              <input value={fTags} onChange={(e) => setFTags(e.target.value)} placeholder="verano, promocion, lifestyle" style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '11px', border: `1px solid ${A.border}`, borderRadius: 10, background: 'transparent', color: A.muted, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 2, padding: '11px', background: A.orange, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
