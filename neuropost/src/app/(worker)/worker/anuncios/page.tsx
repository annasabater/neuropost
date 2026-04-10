'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, X, Upload, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow)";
const fc = "var(--font-barlow-condensed)";

const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
};

type Announcement = {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  target_audience: string;
  is_published: boolean;
  published_at?: string;
  created_at: string;
};

export default function AnunciosPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', image_url: '', target_audience: 'all' });
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setForm({ ...form, image_url: data.url });
        setImagePreview(data.url);
        toast.success('Imagen cargada');
      } else {
        toast.error('Error al cargar imagen');
      }
    } catch (err) {
      toast.error('Error al cargar imagen');
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (file) handleImageUpload(file);
  }

  function openModal(announcement?: Announcement) {
    if (announcement) {
      setEditingId(announcement.id);
      setForm({
        title: announcement.title,
        description: announcement.description,
        image_url: announcement.image_url ?? '',
        target_audience: announcement.target_audience,
      });
      setImagePreview(announcement.image_url ?? null);
    } else {
      setEditingId(null);
      setForm({ title: '', description: '', image_url: '', target_audience: 'all' });
      setImagePreview(null);
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setImagePreview(null);
  }

  async function loadAnnouncements() {
    try {
      const res = await fetch('/api/worker/anuncios?limit=100');
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch (err) {
      console.error('Error loading announcements:', err);
      toast.error('Error al cargar anuncios');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Completa título y descripción');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/worker/anuncios?id=${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          toast.success('Anuncio actualizado');
          loadAnnouncements();
        } else toast.error('Error al actualizar');
      } else {
        const res = await fetch('/api/worker/anuncios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          toast.success('Anuncio creado');
          loadAnnouncements();
        } else toast.error('Error al crear');
      }
      closeModal();
      setForm({ title: '', description: '', image_url: '', target_audience: 'all' });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    try {
      const res = await fetch(`/api/worker/anuncios?id=${id}&action=publish`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Anuncio publicado');
        loadAnnouncements();
      } else toast.error('Error al publicar');
    } catch (err) {
      toast.error('Error al publicar');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar anuncio?')) return;
    try {
      const res = await fetch(`/api/worker/anuncios?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Anuncio eliminado');
        loadAnnouncements();
      } else toast.error('Error al eliminar');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div style={{ padding: '48px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', textTransform: 'uppercase', color: C.text, margin: 0, marginBottom: 8 }}>
            Anuncios
          </h1>
          <p style={{ fontFamily: f, color: C.muted, fontSize: 14, margin: 0 }}>Gestiona los anuncios para tus clientes</p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: C.accent, color: '#fff', border: 'none',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 0,
          }}
        >
          <Plus size={16} /> Nuevo anuncio
        </button>
      </div>

      {loading ? (
        <p style={{ fontFamily: f, color: C.muted }}>Cargando...</p>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 18, color: C.text, margin: 0 }}>Sin anuncios</p>
          <p style={{ fontFamily: f, fontSize: 13, color: C.muted, margin: '8px 0 0 0' }}>Crea el primero para tus clientes</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {announcements.map((a) => (
            <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
              {a.image_url && (
                <img src={a.image_url} alt={a.title} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 800, color: C.text, margin: 0, textTransform: 'uppercase', flex: 1 }}>
                    {a.title}
                  </h3>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 8px',
                    background: a.is_published ? '#d1fae5' : '#fef3c7', color: a.is_published ? '#047857' : '#d97706', textTransform: 'uppercase',
                  }}>
                    {a.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                    {a.is_published ? 'Publicado' : 'Borrador'}
                  </span>
                </div>

                <p style={{ fontFamily: f, fontSize: 13, color: C.muted, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {a.description}
                </p>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {!a.is_published && (
                    <button
                      onClick={() => handlePublish(a.id)}
                      style={{
                        flex: 1, padding: '8px 12px', background: C.accent2, color: '#fff', border: 'none',
                        fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 0,
                      }}
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    onClick={() => openModal(a)}
                    style={{
                      flex: 1, padding: '8px 12px', background: C.bg1, color: C.text, border: `1px solid ${C.border}`,
                      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    style={{
                      padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none',
                      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 0,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 28, maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, color: C.text, margin: 0, textTransform: 'uppercase' }}>
                {editingId ? 'Editar anuncio' : 'Nuevo anuncio'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Título *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Título del anuncio"
                style={{
                  width: '100%', padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`,
                  fontFamily: f, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Descripción *
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción del anuncio"
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`,
                  fontFamily: f, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Imagen (opcional)
              </label>

              {imagePreview ? (
                <div style={{ marginBottom: 12 }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: 200, objectFit: 'cover', border: `1px solid ${C.border}`, marginBottom: 8 }} />
                  <button
                    onClick={() => { setImagePreview(null); setForm({ ...form, image_url: '' }); }}
                    style={{ width: '100%', padding: '8px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Eliminar imagen
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? C.accent2 : C.border}`,
                    borderRadius: 0,
                    padding: '32px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? 'rgba(13, 148, 136, 0.05)' : C.bg1,
                    transition: 'all 0.2s',
                  }}
                >
                  <Upload size={32} style={{ color: C.accent2, margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px 0' }}>
                    Arrastra una imagen aquí
                  </p>
                  <p style={{ fontFamily: f, fontSize: 12, color: C.muted, margin: 0 }}>
                    o haz clic para seleccionar
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1, padding: '10px 16px', background: C.bg1, border: `1px solid ${C.border}`,
                  fontFamily: f, fontSize: 13, fontWeight: 600, color: C.text, cursor: 'pointer', borderRadius: 0,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                style={{
                  flex: 1, padding: '10px 16px', background: C.accent, color: '#fff', border: 'none',
                  fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 0, opacity: saving || uploading ? 0.5 : 1,
                }}
              >
                {uploading ? 'Cargando imagen...' : saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
