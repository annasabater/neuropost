'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, ExternalLink, CreditCard, Users, Bell, Lock, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SocialSector, BrandTone, PublishMode, BrandRules, VisualStyle } from '@/types';
import { SECTOR_OPTIONS, TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { createBrowserClient } from '@/lib/supabase';
import { useTagInput } from '@/hooks/useTagInput';

const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string; emoji: string; desc: string }[] = [
  { value: 'creative', label: 'Creativo y Colorido', emoji: '🎨', desc: 'Colores vibrantes, emojis, texto dinámico' },
  { value: 'elegant',  label: 'Elegante y Minimal',  emoji: '🤍', desc: 'Sin emojis, frases cortas y sofisticadas' },
  { value: 'warm',     label: 'Cálido y Cercano',    emoji: '🧡', desc: 'Tono familiar, tuteo, proximidad' },
  { value: 'dynamic',  label: 'Dinámico y Moderno',  emoji: '⚡', desc: 'Frases cortas, imperativas, mucha energía' },
];

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const NAV_SECTIONS = [
  { id: 'negocio',        label: 'Negocio' },
  { id: 'estilo',         label: 'Estilo visual' },
  { id: 'publicacion',    label: 'Publicación' },
  { id: 'reglas',         label: 'Reglas' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'redes',          label: 'Redes sociales' },
  { id: 'exportar',       label: 'Exportar datos' },
  { id: 'plan',           label: 'Plan' },
  { id: 'cuenta',         label: 'Cuenta' },
  { id: 'equipo',         label: 'Equipo' },
];

export default function SettingsPage() {
  const brand        = useAppStore((s) => s.brand);
  const updateBrand  = useAppStore((s) => s.updateBrand);
  const setBrand     = useAppStore((s) => s.setBrand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const [saving,  setSaving]  = useState(false);
  const [billing, setBilling] = useState(false);

  // Basic info
  const [name,       setName]       = useState('');
  const [sector,     setSector]     = useState<SocialSector>('otro');
  const [tone,        setTone]        = useState<BrandTone>('cercano');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('warm');
  const [location,    setLocation]    = useState('');

  // Publish mode
  const [publishMode, setPublishMode] = useState<PublishMode>('manual');

  // Rules
  const [noPublishDays,       setNoPublishDays]       = useState<number[]>([]);
  const [noEmojis,            setNoEmojis]            = useState(false);
  const [noAutoReplyNegative, setNoAutoReplyNegative] = useState(false);
  const [forbiddenWords,      setForbiddenWords]      = useState<string[]>([]);
  const [forbiddenTopics,     setForbiddenTopics]     = useState<string[]>([]);
  const [fwInput,  setFwInput]  = useState('');
  const [ftInput,  setFtInput]  = useState('');
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();

  // Notifications
  const [notifyPublish,  setNotifyPublish]  = useState(false);
  const [notifyComments, setNotifyComments] = useState(false);
  const [savingNotifs,   setSavingNotifs]   = useState(false);

  // Account
  const [userEmail,       setUserEmail]       = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteZone,  setShowDeleteZone]  = useState(false);

  // Active nav section (IntersectionObserver)
  const [activeSection, setActiveSection] = useState('negocio');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Load user email from Supabase on mount
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  // Fallback: fetch brand directly from API if store doesn't have it
  useEffect(() => {
    if (brand || brandLoading) return;
    fetch('/api/brands')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { brand?: Parameters<typeof setBrand>[0] } | null) => { if (data?.brand) setBrand(data.brand); })
      .catch(() => {});
  }, [brand, brandLoading, setBrand]);

  // IntersectionObserver for active nav highlight
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [setupObserver]);

  useEffect(() => {
    if (!brand) return;
    setName(brand.name ?? '');
    setSector(brand.sector ?? 'otro');
    setTone(brand.tone ?? 'cercano');
    setVisualStyle(brand.visual_style ?? 'warm');
    setLocation(brand.location ?? '');
    setPublishMode(brand.publish_mode ?? 'manual');
    setNotifyPublish(brand.notify_email_publish ?? false);
    setNotifyComments(brand.notify_email_comments ?? false);

    const rules = brand.rules as BrandRules | null;
    setNoPublishDays(rules?.noPublishDays ?? []);
    setNoEmojis(rules?.noEmojis ?? false);
    setNoAutoReplyNegative(rules?.noAutoReplyNegative ?? false);
    setForbiddenWords(rules?.forbiddenWords ?? []);
    setForbiddenTopics(rules?.forbiddenTopics ?? []);
  }, [brand]);

  function toggleDay(day: number) {
    setNoPublishDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const rules: BrandRules = {
        noPublishDays,
        noEmojis,
        noAutoReplyNegative,
        forbiddenWords,
        forbiddenTopics,
      };
      const res = await fetch('/api/brands', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, sector, tone, visual_style: visualStyle, location, publish_mode: publishMode, rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
      updateBrand(json.brand);
      toast.success('Ajustes guardados');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSavingNotifs(true);
    try {
      const res = await fetch('/api/brands', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notify_email_publish: notifyPublish, notify_email_comments: notifyComments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
      updateBrand(json.brand);
      toast.success('Notificaciones actualizadas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSavingNotifs(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Contraseña actualizada correctamente');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setSavingPassword(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'ELIMINAR') {
      toast.error('Escribe ELIMINAR para confirmar');
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/brands/account', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al eliminar la cuenta');
      toast.success('Cuenta eliminada. Hasta pronto.');
      // Redirect to login after short delay
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
      setDeletingAccount(false);
    }
  }

  async function openBillingPortal() {
    setBilling(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setBilling(false);
    }
  }

  async function handleUpgrade(plan: 'pro' | 'agency') {
    const res  = await fetch('/api/stripe/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan }),
    });
    const json = await res.json() as { url?: string };
    if (json.url) window.location.href = json.url;
  }

  async function connectMeta() {
    const res  = await fetch('/api/meta/oauth-url');
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!brand) return <div className="page-content"><p style={{ color: 'var(--muted)' }}>{brandLoading ? 'Cargando...' : 'No se pudo cargar tu marca. Recarga la página.'}</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Ajustes</h1>
          <p className="page-sub">Configura tu negocio, modo de publicación y reglas</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Left sticky nav */}
        <div
          style={{
            width: 160,
            flexShrink: 0,
            position: 'sticky',
            top: 80,
            alignSelf: 'flex-start',
          }}
          className="settings-sidenav"
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => scrollTo(id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: activeSection === id ? 'var(--orange-light)' : 'transparent',
                    color: activeSection === id ? 'var(--orange)' : 'var(--muted)',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontWeight: activeSection === id ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {/* Responsive hide via inline style injection */}
          <style>{`
            @media (max-width: 768px) {
              .settings-sidenav { display: none !important; }
            }
          `}</style>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          <form onSubmit={saveBrand}>
            {/* ── Negocio ── */}
            <div id="negocio" className="settings-section">
              <h2 className="settings-section-title">Información del negocio</h2>
              <div className="settings-grid">
                <div className="form-group">
                  <label>Nombre del negocio</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <input type="text" placeholder="Madrid, España" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Sector</label>
                  <select value={sector} onChange={(e) => setSector(e.target.value as SocialSector)}>
                    {SECTOR_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tono de comunicación</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value as BrandTone)}>
                    {TONE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Estilo visual ── */}
            <div id="estilo" className="settings-section">
              <h2 className="settings-section-title">Estilo visual</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                La IA adaptará edición, emojis y tipo de contenido según este estilo
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {VISUAL_STYLE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setVisualStyle(s.value)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      border: `1.5px solid ${visualStyle === s.value ? 'var(--orange)' : 'var(--border)'}`,
                      background: visualStyle === s.value ? 'var(--orange-light)' : 'var(--surface)',
                    }}
                  >
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.88rem', marginBottom: 3 }}>
                      {s.emoji} {s.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{s.desc}</div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 10 }}>
                Cambiar el estilo afecta al contenido nuevo. El contenido ya publicado no cambiará.
              </p>
            </div>

            {/* ── Publicación ── */}
            <div id="publicacion" className="settings-section">
              <h2 className="settings-section-title">Modo de publicación</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                Elige cómo quieres que gestionemos la publicación de tu contenido
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PUBLISH_MODE_OPTIONS.map((m) => (
                  <label
                    key={m.value}
                    style={{
                      display:     'flex',
                      alignItems:  'center',
                      gap:         14,
                      padding:     '12px 16px',
                      borderRadius: 10,
                      border:      `1.5px solid ${publishMode === m.value ? 'var(--orange)' : 'var(--border)'}`,
                      background:  publishMode === m.value ? 'var(--orange-light)' : 'var(--surface)',
                      cursor:      'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="publish_mode"
                      value={m.value}
                      checked={publishMode === m.value}
                      onChange={() => setPublishMode(m.value)}
                      style={{ accentColor: 'var(--orange)', width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.88rem' }}>{m.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Reglas ── */}
            <div id="reglas" className="settings-section">
              <h2 className="settings-section-title">Reglas de contenido</h2>

              {/* No-publish days */}
              <div className="form-group">
                <label>Días sin publicar</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      style={{
                        padding:      '6px 12px',
                        borderRadius: 8,
                        border:       `1.5px solid ${noPublishDays.includes(i) ? '#dc2626' : 'var(--border)'}`,
                        background:   noPublishDays.includes(i) ? '#fef2f2' : 'var(--surface)',
                        color:        noPublishDays.includes(i) ? '#dc2626' : 'var(--ink)',
                        fontFamily:   "'Cabinet Grotesk', sans-serif",
                        fontWeight:   600,
                        fontSize:     '0.82rem',
                        cursor:       'pointer',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {noPublishDays.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6 }}>
                    No se publicará los {noPublishDays.map((d) => DAY_LABELS[d]).join(', ')}
                  </p>
                )}
              </div>

              {/* Forbidden words */}
              <div className="form-group">
                <label>Palabras prohibidas</label>
                <div className="tags-input-area">
                  {forbiddenWords.map((w) => (
                    <span key={w} className="tag-chip" style={{ background: '#ffeded' }}>
                      {w}<button type="button" onClick={() => removeTag(forbiddenWords, setForbiddenWords, w)}>×</button>
                    </span>
                  ))}
                  <input
                    value={fwInput}
                    onChange={(e) => setFwInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, forbiddenWords, setForbiddenWords, fwInput, setFwInput)}
                    onBlur={() => { if (fwInput.trim()) { addTag(forbiddenWords, setForbiddenWords, fwInput); setFwInput(''); } }}
                    placeholder="barato, descuento, ofertón..."
                  />
                </div>
              </div>

              {/* Forbidden topics */}
              <div className="form-group">
                <label>Temas prohibidos</label>
                <div className="tags-input-area">
                  {forbiddenTopics.map((t) => (
                    <span key={t} className="tag-chip" style={{ background: '#fff3cd' }}>
                      {t}<button type="button" onClick={() => removeTag(forbiddenTopics, setForbiddenTopics, t)}>×</button>
                    </span>
                  ))}
                  <input
                    value={ftInput}
                    onChange={(e) => setFtInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, forbiddenTopics, setForbiddenTopics, ftInput, setFtInput)}
                    onBlur={() => { if (ftInput.trim()) { addTag(forbiddenTopics, setForbiddenTopics, ftInput); setFtInput(''); } }}
                    placeholder="política, religión, competencia..."
                  />
                </div>
              </div>

              {/* Toggle switches */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={noEmojis}
                    onChange={(e) => setNoEmojis(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--orange)' }}
                  />
                  <div>
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem' }}>Sin emojis</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 8 }}>La IA no usará emojis en el contenido</span>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={noAutoReplyNegative}
                    onChange={(e) => setNoAutoReplyNegative(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--orange)' }}
                  />
                  <div>
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem' }}>No responder automáticamente a comentarios negativos</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 8 }}>Se escalarán para revisión manual</span>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <><span className="loading-spinner" />Guardando...</> : <><Save size={16} />Guardar cambios</>}
              </button>
            </div>
          </form>

          {/* ── Notificaciones ── */}
          <div id="notificaciones" className="settings-section">
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} />Notificaciones por email
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 16 }}>
              Elige qué eventos te avisamos por email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* notify_email_publish toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <div>
                  <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                    Notificaciones de publicación
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>
                    Recibe un email cuando se publique un post
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyPublish}
                  onClick={() => setNotifyPublish((v) => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: notifyPublish ? 'var(--orange)' : 'var(--border)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: notifyPublish ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
              </div>

              {/* notify_email_comments toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <div>
                  <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                    Notificaciones de comentarios
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>
                    Recibe un email cuando llegue un nuevo comentario
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyComments}
                  onClick={() => setNotifyComments((v) => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: notifyComments ? 'var(--orange)' : 'var(--border)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: notifyComments ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={saveNotifications} disabled={savingNotifs}>
                {savingNotifs ? <><span className="loading-spinner" />Guardando...</> : <><Save size={16} />Guardar notificaciones</>}
              </button>
            </div>
          </div>

          {/* ── Redes sociales ── */}
          <div id="redes" className="settings-section">
            <h2 className="settings-section-title">Redes sociales</h2>
            <div className="connection-item">
              <div className="connection-info">
                <p className="connection-name">Instagram</p>
                <p className={`connection-status ${brand.ig_account_id ? 'connected' : ''}`}>
                  {brand.ig_account_id ? `Conectado · @${brand.ig_username ?? brand.ig_account_id}` : 'Sin conectar'}
                </p>
              </div>
              <button className="btn-outline" onClick={connectMeta}>
                <ExternalLink size={14} />
                {brand.ig_account_id ? 'Reconectar' : 'Conectar'}
              </button>
            </div>
            <div className="connection-item">
              <div className="connection-info">
                <p className="connection-name">Facebook</p>
                <p className={`connection-status ${brand.fb_page_id ? 'connected' : ''}`}>
                  {brand.fb_page_id
                    ? `Conectado · ${brand.fb_page_name ?? `Página ${brand.fb_page_id}`}`
                    : 'Sin conectar'}
                </p>
              </div>
              <button className="btn-outline" onClick={connectMeta}>
                <ExternalLink size={14} />
                {brand.fb_page_id ? 'Reconectar' : 'Conectar'}
              </button>
            </div>
            {brand.meta_token_expires_at && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 8 }}>
                Token expira: {new Date(brand.meta_token_expires_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* ── Exportar datos ── */}
          <div id="exportar" className="settings-section">
            <h2 className="settings-section-title">Exportar datos</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
              Descarga todos tus posts en el formato que prefieras.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="/api/export?format=json"
                download="posts.json"
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            6,
                  padding:        '9px 18px',
                  border:         '1px solid var(--border)',
                  borderRadius:   8,
                  fontSize:       13,
                  fontWeight:     600,
                  color:          'var(--ink)',
                  textDecoration: 'none',
                  background:     'var(--surface)',
                  cursor:         'pointer',
                }}
              >
                Exportar JSON
              </a>
              <a
                href="/api/export?format=csv"
                download="posts.csv"
                style={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  gap:            6,
                  padding:        '9px 18px',
                  border:         '1.5px solid var(--orange)',
                  borderRadius:   8,
                  fontSize:       13,
                  fontWeight:     600,
                  color:          'var(--orange)',
                  textDecoration: 'none',
                  background:     'var(--surface)',
                  cursor:         'pointer',
                }}
              >
                Exportar CSV
              </a>
            </div>
          </div>

          {/* ── Plan y facturación ── */}
          <div id="plan" className="settings-section">
            <h2 className="settings-section-title">
              <CreditCard size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Plan y facturación
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                  Plan actual: <span style={{ textTransform: 'capitalize' }}>{brand.plan}</span>
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>
                  {brand.plan === 'starter' ? '12 posts/mes · Instagram y Facebook' :
                   brand.plan === 'pro'     ? 'Posts ilimitados · Publicación automática' :
                                              'Todo incluido · Multi-marca · Soporte prioritario'}
                </p>
              </div>
              <button className="btn-outline" onClick={openBillingPortal} disabled={billing}>
                {billing ? <span className="loading-spinner" /> : <ExternalLink size={14} />}
                Gestionar suscripción
              </button>
            </div>
            {brand.plan === 'starter' && (
              <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--orange-light)', borderRadius: 10, border: '1px solid var(--orange)' }}>
                <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>
                  Actualiza a Pro
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink)', marginBottom: 12 }}>
                  Desbloquea posts ilimitados, publicación automática y más por 29€/mes.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary btn-orange" onClick={() => handleUpgrade('pro')}>
                    Actualizar a Pro — 29€/mes
                  </button>
                  <button className="btn-outline" onClick={() => handleUpgrade('agency')}>
                    Agency — 79€/mes
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Cuenta ── */}
          <div id="cuenta" className="settings-section">
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} />Cuenta
            </h2>

            {/* Current email */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>Email de la cuenta</label>
              <input
                type="email"
                value={userEmail}
                readOnly
                style={{ background: 'var(--surface-2, #f9f9f9)', cursor: 'default', color: 'var(--muted)' }}
              />
            </div>

            {/* Change password */}
            <form onSubmit={changePassword}>
              <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.92rem', marginBottom: 12 }}>
                Cambiar contraseña
              </p>
              <div className="settings-grid" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-outline" disabled={savingPassword}>
                {savingPassword ? <><span className="loading-spinner" />Cambiando...</> : <><Lock size={14} />Cambiar contraseña</>}
              </button>
            </form>

            {/* Danger zone */}
            <div style={{ marginTop: 32 }}>
              <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.92rem', color: '#dc2626', marginBottom: 8 }}>
                Zona de peligro
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                Eliminar tu cuenta borrará permanentemente todos tus datos, posts y configuración. Esta acción no se puede deshacer.
              </p>

              {!showDeleteZone ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteZone(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 18px', borderRadius: 8, border: '1.5px solid #dc2626',
                    background: 'transparent', color: '#dc2626',
                    fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />Eliminar mi cuenta
                </button>
              ) : (
                <div style={{ padding: '16px 20px', borderRadius: 10, border: '1.5px solid #dc2626', background: '#fef2f2' }}>
                  <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
                    Escribe ELIMINAR para confirmar:
                  </p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder="ELIMINAR"
                      style={{
                        padding: '8px 12px', borderRadius: 8, border: '1px solid #dc2626',
                        fontSize: '0.88rem', width: 160,
                      }}
                    />
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deletingAccount || deleteConfirm !== 'ELIMINAR'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 8, border: 'none',
                        background: deleteConfirm === 'ELIMINAR' ? '#dc2626' : '#fca5a5',
                        color: '#fff',
                        fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700,
                        fontSize: '0.85rem', cursor: deleteConfirm === 'ELIMINAR' ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {deletingAccount ? <><span className="loading-spinner" />Eliminando...</> : <><Trash2 size={14} />Eliminar cuenta definitivamente</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteZone(false); setDeleteConfirm(''); }}
                      style={{
                        padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--muted)',
                        fontSize: '0.85rem', cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Equipo ── */}
          <div id="equipo" className="settings-section">
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} />Equipo
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
              Gestiona los miembros de tu equipo y sus permisos.
            </p>
            <Link
              href="/settings/team"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            8,
                padding:        '10px 18px',
                border:         '1px solid var(--border)',
                borderRadius:   10,
                fontSize:       13,
                fontWeight:     600,
                color:          'var(--ink)',
                textDecoration: 'none',
                background:     'var(--surface)',
              }}
            >
              <Users size={16} />Gestionar equipo →
            </Link>
          </div>

        </div>{/* end right content */}
      </div>{/* end two-column layout */}
    </div>
  );
}
