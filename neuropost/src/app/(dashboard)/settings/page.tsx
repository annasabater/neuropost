'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, ExternalLink, CreditCard, Users } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SocialSector, BrandTone, PublishMode, BrandRules, VisualStyle } from '@/types';
import { SECTOR_OPTIONS, TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';

const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string; emoji: string; desc: string }[] = [
  { value: 'creative', label: 'Creativo y Colorido', emoji: '🎨', desc: 'Colores vibrantes, emojis, texto dinámico' },
  { value: 'elegant',  label: 'Elegante y Minimal',  emoji: '🤍', desc: 'Sin emojis, frases cortas y sofisticadas' },
  { value: 'warm',     label: 'Cálido y Cercano',    emoji: '🧡', desc: 'Tono familiar, tuteo, proximidad' },
  { value: 'dynamic',  label: 'Dinámico y Moderno',  emoji: '⚡', desc: 'Frases cortas, imperativas, mucha energía' },
];
import { useTagInput } from '@/hooks/useTagInput';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function SettingsPage() {
  const brand       = useAppStore((s) => s.brand);
  const updateBrand = useAppStore((s) => s.updateBrand);
  const [saving,  setSaving]  = useState(false);
  const [billing, setBilling] = useState(false);

  // Basic info
  const [name,     setName]     = useState('');
  const [sector,   setSector]   = useState<SocialSector>('otro');
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

  useEffect(() => {
    if (!brand) return;
    setName(brand.name ?? '');
    setSector(brand.sector ?? 'otro');
    setTone(brand.tone ?? 'cercano');
    setVisualStyle(brand.visual_style ?? 'warm');
    setLocation(brand.location ?? '');
    setPublishMode(brand.publish_mode ?? 'manual');

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

  if (!brand) return <div className="page-content"><p style={{ color: 'var(--muted)' }}>Cargando...</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Ajustes</h1>
          <p className="page-sub">Configura tu negocio, modo de publicación y reglas</p>
        </div>
      </div>

      {/* Quick-nav tiles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { href: '/settings/connections', icon: <ExternalLink size={18} />, label: 'Conexiones' },
          { href: '/settings/plan',        icon: <CreditCard size={18} />, label: 'Plan y facturación' },
          { href: '/settings/team',        icon: <Users size={18} />,     label: 'Equipo' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display:        'flex',
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
            {item.icon} {item.label} →
          </Link>
        ))}
      </div>

      <form onSubmit={saveBrand}>
        {/* Brand info */}
        <div className="settings-section">
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

        {/* Visual style */}
        <div className="settings-section">
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

        {/* Publish mode */}
        <div className="settings-section">
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

        {/* Rules */}
        <div className="settings-section">
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

      {/* Social connections */}
      <div className="settings-section">
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

      {/* Data export */}
      <div className="settings-section">
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

      {/* Billing */}
      <div className="settings-section">
        <h2 className="settings-section-title">Plan y facturación</h2>
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
    </div>
  );
}