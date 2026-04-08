'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, ExternalLink, CreditCard, Users, Bell, Lock, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/store/useAppStore';
import type { SocialSector, BrandTone, PublishMode, BrandRules, VisualStyle } from '@/types';
import { SECTOR_OPTIONS, TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { createBrowserClient } from '@/lib/supabase';
import { useTagInput } from '@/hooks/useTagInput';

export default function SettingsPage() {
  const brand        = useAppStore((s) => s.brand);
  const updateBrand  = useAppStore((s) => s.updateBrand);
  const setBrand     = useAppStore((s) => s.setBrand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const t            = useTranslations('settings');
  const tc           = useTranslations('calendar');
  const tAuthErr     = useTranslations('auth.register');

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

  // Dynamic data depending on translations
  const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string; emoji: string; desc: string }[] = [
    { value: 'creative', label: t('styles.creative.label'), emoji: '🎨', desc: t('styles.creative.desc') },
    { value: 'elegant',  label: t('styles.elegant.label'),  emoji: '🤍', desc: t('styles.elegant.desc') },
    { value: 'warm',     label: t('styles.warm.label'),     emoji: '🧡', desc: t('styles.warm.desc') },
    { value: 'dynamic',  label: t('styles.dynamic.label'),  emoji: '⚡', desc: t('styles.dynamic.desc') },
  ];

  const DAY_LABELS = [
    tc('days.sun'), tc('days.mon'), tc('days.tue'), tc('days.wed'),
    tc('days.thu'), tc('days.fri'), tc('days.sat'),
  ];

  const NAV_SECTIONS = [
    { id: 'negocio',        label: t('nav.business') },
    { id: 'estilo',         label: t('nav.visualStyle') },
    { id: 'publicacion',    label: t('nav.publishMode') },
    { id: 'reglas',         label: t('nav.rules') },
    { id: 'notificaciones', label: t('sections.notifications') },
    { id: 'redes',          label: t('nav.social') },
    { id: 'exportar',       label: t('nav.export') },
    { id: 'plan',           label: t('nav.plan') },
    { id: 'cuenta',         label: t('nav.account') },
    { id: 'equipo',         label: t('nav.team') },
  ];

  const confirmWord = t('account.deleteConfirmWord');

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!res.ok) throw new Error(json.error ?? 'Error');
      updateBrand(json.brand);
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
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
      if (!res.ok) throw new Error(json.error ?? 'Error');
      updateBrand(json.brand);
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingNotifs(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(tAuthErr('errors.passwordsNoMatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(tAuthErr('errors.passwordTooShort'));
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t('account.saved'));
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingPassword(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== confirmWord) {
      toast.error(t('account.deleteConfirmPrompt'));
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/brands/account', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      toast.success('Bye!');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
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

  if (!brand) return (
    <div className="page-content">
      <p style={{ color: 'var(--muted)' }}>{brandLoading ? t('saving') : 'Error'}</p>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">{t('subtitle')}</p>
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

            .notif-title-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .notif-subtitle {
              font-size: 0.84rem;
              color: var(--muted);
              margin-bottom: 16px;
            }

            .notif-list {
              display: flex;
              flex-direction: column;
              gap: 14px;
            }

            .notif-card {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 14px 16px;
              border-radius: 10px;
              border: 1px solid var(--border);
              background: var(--surface);
            }

            .notif-card-title {
              font-family: 'Cabinet Grotesk', sans-serif;
              font-weight: 600;
              font-size: 0.88rem;
              margin: 0;
            }

            .notif-card-desc {
              font-size: 0.78rem;
              color: var(--muted);
              margin: 3px 0 0;
            }

            .notif-switch {
              width: 44px;
              height: 24px;
              border-radius: 12px;
              border: none;
              cursor: pointer;
              background: var(--border);
              position: relative;
              flex-shrink: 0;
              transition: background 0.2s;
            }

            .notif-switch.is-on {
              background: var(--orange);
            }

            .notif-switch-thumb {
              position: absolute;
              top: 3px;
              left: 3px;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: #fff;
              transition: left 0.2s;
              display: block;
            }

            .notif-switch.is-on .notif-switch-thumb {
              left: 23px;
            }

            .notif-actions {
              margin-top: 16px;
            }
          `}</style>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          <form onSubmit={saveBrand}>
            {/* ── Negocio ── */}
            <div id="negocio" className="settings-section">
              <h2 className="settings-section-title">{t('business.title')}</h2>
              <div className="settings-grid">
                <div className="form-group">
                  <label htmlFor="business-name">{t('business.name')}</label>
                  <input
                    id="business-name"
                    type="text"
                    title={t('business.name')}
                    placeholder={t('business.name')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('business.location')}</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{t('business.sector')}</label>
                  <select value={sector} onChange={(e) => setSector(e.target.value as SocialSector)}>
                    {SECTOR_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('business.tone')}</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value as BrandTone)}>
                    {TONE_OPTIONS.map((tone_) => <option key={tone_.value} value={tone_.value}>{tone_.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Estilo visual ── */}
            <div id="estilo" className="settings-section">
              <h2 className="settings-section-title">{t('visualStyle.title')}</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                {t('visualStyle.subtitle')}
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
                {t('visualStyle.note')}
              </p>
            </div>

            {/* ── Publicación ── */}
            <div id="publicacion" className="settings-section">
              <h2 className="settings-section-title">{t('publishMode.title')}</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                {t('publishMode.subtitle')}
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
              <h2 className="settings-section-title">{t('rules.title')}</h2>

              {/* No-publish days */}
              <div className="form-group">
                <label>{t('rules.noPublishDays')}</label>
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
                    {t('rules.noPublishNote', { days: noPublishDays.map((d) => DAY_LABELS[d]).join(', ') })}
                  </p>
                )}
              </div>

              {/* Forbidden words */}
              <div className="form-group">
                <label>{t('rules.forbiddenWords')}</label>
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
                <label>{t('rules.forbiddenTopics')}</label>
                <div className="tags-input-area">
                  {forbiddenTopics.map((topic) => (
                    <span key={topic} className="tag-chip" style={{ background: '#fff3cd' }}>
                      {topic}<button type="button" onClick={() => removeTag(forbiddenTopics, setForbiddenTopics, topic)}>×</button>
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
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem' }}>{t('rules.noEmojis')}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 8 }}>{t('rules.noEmojisDesc')}</span>
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
                    <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 600, fontSize: '0.88rem' }}>{t('rules.noAutoReply')}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 8 }}>{t('rules.noAutoReplyDesc')}</span>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <><span className="loading-spinner" />{t('saving')}</> : <><Save size={16} />{t('account.saveChanges')}</>}
              </button>
            </div>
          </form>

          {/* ── Notificaciones ── */}
          <div id="notificaciones" className="settings-section">
            <h2 className="settings-section-title notif-title-row">
              <Bell size={18} />{t('notifSection.title')}
            </h2>
            <p className="notif-subtitle">
              {t('notifSection.subtitle')}
            </p>

            <div className="notif-list">
              {/* notify_email_publish toggle */}
              <div className="notif-card">
                <div>
                  <p className="notif-card-title">
                    {t('notifSection.publishTitle')}
                  </p>
                  <p className="notif-card-desc">
                    {t('notifSection.publishDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyPublish ? 'true' : 'false'}
                  aria-label={t('notifSection.publishTitle')}
                  title={t('notifSection.publishTitle')}
                  onClick={() => setNotifyPublish((v) => !v)}
                  className={`notif-switch ${notifyPublish ? 'is-on' : ''}`}
                >
                  <span className="notif-switch-thumb" />
                </button>
              </div>

              {/* notify_email_comments toggle */}
              <div className="notif-card">
                <div>
                  <p className="notif-card-title">
                    {t('notifSection.commentsTitle')}
                  </p>
                  <p className="notif-card-desc">
                    {t('notifSection.commentsDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyComments ? 'true' : 'false'}
                  aria-label={t('notifSection.commentsTitle')}
                  title={t('notifSection.commentsTitle')}
                  onClick={() => setNotifyComments((v) => !v)}
                  className={`notif-switch ${notifyComments ? 'is-on' : ''}`}
                >
                  <span className="notif-switch-thumb" />
                </button>
              </div>
            </div>

            <div className="notif-actions">
              <button className="btn-primary" onClick={saveNotifications} disabled={savingNotifs}>
                {savingNotifs ? <><span className="loading-spinner" />{t('saving')}</> : <><Save size={16} />{t('notifSection.save')}</>}
              </button>
            </div>
          </div>

          {/* ── Redes sociales ── */}
          <div id="redes" className="settings-section">
            <h2 className="settings-section-title">{t('social.title')}</h2>
            <div className="connection-item">
              <div className="connection-info">
                <p className="connection-name">Instagram</p>
                <p className={`connection-status ${brand.ig_account_id ? 'connected' : ''}`}>
                  {brand.ig_account_id ? `${t('connections.connected')} · @${brand.ig_username ?? brand.ig_account_id}` : t('social.notConnected')}
                </p>
              </div>
              <button className="btn-outline" onClick={connectMeta}>
                <ExternalLink size={14} />
                {brand.ig_account_id ? t('connections.reconnect') : t('connections.connect')}
              </button>
            </div>
            <div className="connection-item">
              <div className="connection-info">
                <p className="connection-name">Facebook</p>
                <p className={`connection-status ${brand.fb_page_id ? 'connected' : ''}`}>
                  {brand.fb_page_id
                    ? `${t('connections.connected')} · ${brand.fb_page_name ?? `Página ${brand.fb_page_id}`}`
                    : t('social.notConnected')}
                </p>
              </div>
              <button className="btn-outline" onClick={connectMeta}>
                <ExternalLink size={14} />
                {brand.fb_page_id ? t('connections.reconnect') : t('connections.connect')}
              </button>
            </div>
            {brand.meta_token_expires_at && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 8 }}>
                {t('social.tokenExpires')} {new Date(brand.meta_token_expires_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* ── Exportar datos ── */}
          <div id="exportar" className="settings-section">
            <h2 className="settings-section-title">{t('export.title')}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
              {t('export.subtitle')}
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
                {t('export.json')}
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
                {t('export.csv')}
              </a>
            </div>
          </div>

          {/* ── Plan y facturación ── */}
          <div id="plan" className="settings-section">
            <h2 className="settings-section-title">
              <CreditCard size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {t('billing.title')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                  {t('plan.current')}: <span style={{ textTransform: 'capitalize' }}>{brand.plan}</span>
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>
                  {brand.plan === 'starter' ? '12 posts/mes · Instagram y Facebook' :
                   brand.plan === 'pro'     ? 'Posts ilimitados · Publicación automática' :
                                              'Todo incluido · Multi-marca · Soporte prioritario'}
                </p>
              </div>
              <button className="btn-outline" onClick={openBillingPortal} disabled={billing}>
                {billing ? <span className="loading-spinner" /> : <ExternalLink size={14} />}
                {t('billing.manageSubscription')}
              </button>
            </div>
            {brand.plan === 'starter' && (
              <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--orange-light)', borderRadius: 10, border: '1px solid var(--orange)' }}>
                <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: 'var(--orange)', marginBottom: 4 }}>
                  {t('billing.upgradeTitle')}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink)', marginBottom: 12 }}>
                  {t('billing.upgradeDesc')}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary btn-orange" onClick={() => handleUpgrade('pro')}>
                    {t('billing.upgradeCTA')}
                  </button>
                  <button className="btn-outline" onClick={() => handleUpgrade('agency')}>
                    {t('billing.agencyCTA')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Cuenta ── */}
          <div id="cuenta" className="settings-section">
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} />{t('account.title')}
            </h2>

            {/* Current email */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label>{t('account.email')}</label>
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
                {t('account.changePassword')}
              </p>
              <div className="settings-grid" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label>{t('account.newPassword')}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8"
                    minLength={8}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('account.confirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Min. 8"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-outline" disabled={savingPassword}>
                {savingPassword ? <><span className="loading-spinner" />{t('account.changingPassword')}</> : <><Lock size={14} />{t('account.changePassword')}</>}
              </button>
            </form>

            {/* Danger zone */}
            <div style={{ marginTop: 32 }}>
              <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.92rem', color: '#dc2626', marginBottom: 8 }}>
                {t('account.dangerZone')}
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: 14 }}>
                {t('account.dangerDesc')}
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
                  <Trash2 size={14} />{t('account.deleteAccount')}
                </button>
              ) : (
                <div style={{ padding: '16px 20px', borderRadius: 10, border: '1.5px solid #dc2626', background: '#fef2f2' }}>
                  <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600, marginBottom: 10 }}>
                    {t('account.deleteConfirmPrompt')}
                  </p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder={confirmWord}
                      style={{
                        padding: '8px 12px', borderRadius: 8, border: '1px solid #dc2626',
                        fontSize: '0.88rem', width: 160,
                      }}
                    />
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deletingAccount || deleteConfirm !== confirmWord}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 8, border: 'none',
                        background: deleteConfirm === confirmWord ? '#dc2626' : '#fca5a5',
                        color: '#fff',
                        fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700,
                        fontSize: '0.85rem', cursor: deleteConfirm === confirmWord ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {deletingAccount ? <><span className="loading-spinner" />{t('account.deleting')}</> : <><Trash2 size={14} />{t('account.deleteConfirmBtn')}</>}
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
                      {t('account.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Equipo ── */}
          <div id="equipo" className="settings-section">
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} />{t('team.title')}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
              {t('team.subtitle')}
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
              <Users size={16} />{t('team.manage')}
            </Link>
          </div>

        </div>{/* end right content */}
      </div>{/* end two-column layout */}
    </div>
  );
}
