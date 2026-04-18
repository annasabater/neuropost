'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Save, ExternalLink, CreditCard, Bell, Lock, Trash2, Sun, Moon, Globe,
  AlertCircle, Wrench, BarChart3, Megaphone, Settings as SettingsIcon, ChevronDown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { locales, localeNames, defaultLocale, type Locale } from '@/i18n/config';
import { PLAN_META } from '@/types';
import type { ContentCategory } from '@/types';

export default function SettingsPage() {
  const brand        = useAppStore((s) => s.brand);
  const updateBrand  = useAppStore((s) => s.updateBrand);
  const setBrand     = useAppStore((s) => s.setBrand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const t            = useTranslations('settings');
  const tAuthErr     = useTranslations('auth.register');

  const [billing, setBilling] = useState(false);

  // Profile (Perfil section) — local editable copies of brand fields.
  const [profileLogo,        setProfileLogo]        = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState('');
  const [profileTimezone,    setProfileTimezone]    = useState('Europe/Madrid');
  const [uploadingLogo,      setUploadingLogo]      = useState(false);
  const [savingProfile,      setSavingProfile]      = useState(false);

  // Personal profile — editable name fields from Supabase auth metadata
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [showName,      setShowName]      = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Notifications — legacy brand fields (kept for back-compat)
  const [notifyPublish,  setNotifyPublish]  = useState(false);
  const [notifyComments, setNotifyComments] = useState(false);
  const [savingNotifs,   setSavingNotifs]   = useState(false);

  // Extended notification_preferences (20+ toggles + language + frequency)
  type NotifPrefs = {
    approval_needed_email?:       boolean;
    ticket_reply_email?:          boolean;
    chat_message_email?:          boolean;
    recreation_ready_email?:      boolean;
    comment_pending_email?:       boolean;
    token_expired_email?:         boolean;
    post_published_email?:        boolean;
    post_failed_email?:           boolean;
    payment_failed_email?:        boolean;
    trial_ending_email?:          boolean;
    limit_reached_email?:         boolean;
    reactivation_email?:          boolean;
    no_content_email?:            boolean;
    onboarding_incomplete_email?: boolean;
    no_social_connected_email?:   boolean;
    plan_unused_email?:           boolean;
    weekly_report_email?:         boolean;
    monthly_report_email?:        boolean;
    daily_digest_email?:          boolean;
    marketing_email?:             boolean;
    product_updates_email?:       boolean;
    newsletter_email?:            boolean;
    email_language?:              string | null;
    max_frequency?:               'immediate' | 'daily' | 'weekly';
  };
  const [prefs,        setPrefs]        = useState<NotifPrefs | null>(null);
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accordion — which group is open (only one at a time)
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Inline "✓ Guardado" pulse by group id
  const [savedPulse, setSavedPulse] = useState<string | null>(null);
  const savedPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore last-opened group from localStorage
  useEffect(() => {
    try {
      const last = window.localStorage.getItem('neuropost.prefs.openGroup');
      if (last) setOpenGroup(last);
    } catch { /* ignore */ }
  }, []);

  function toggleGroup(id: string) {
    setOpenGroup(prev => {
      const next = prev === id ? null : id;
      try { window.localStorage.setItem('neuropost.prefs.openGroup', next ?? ''); } catch { /* ignore */ }
      return next;
    });
  }

  // Load prefs once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/notifications');
        if (!res.ok) return;
        const json = await res.json() as { preferences: NotifPrefs };
        setPrefs(json.preferences ?? {});
      } catch { /* silent */ }
    })();
  }, []);

  /**
   * Debounced PATCH — updates local state immediately, persists after 500ms.
   * Shows an inline "✓ Guardado" pulse next to the group counter when
   * `groupId` is provided. No full-screen toast (redesign spec).
   */
  function updatePref<K extends keyof NotifPrefs>(
    key:     K,
    value:   NotifPrefs[K],
    groupId?: string,
  ) {
    setPrefs(prev => ({ ...(prev ?? {}), [key]: value }));
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current);
    prefsSaveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });
        if (!res.ok) throw new Error('Save failed');
        if (groupId) {
          setSavedPulse(groupId);
          if (savedPulseTimer.current) clearTimeout(savedPulseTimer.current);
          savedPulseTimer.current = setTimeout(() => setSavedPulse(null), 2000);
        }
      } catch {
        toast.error('No se pudo guardar');
      }
    }, 500);
  }

  // Account
  const [userEmail,       setUserEmail]       = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteZone,  setShowDeleteZone]  = useState(false);

  // Active nav section (IntersectionObserver)
  const [activeSection, setActiveSection] = useState('tema');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Brand-identity sections (negocio, estilo, publicacion, reglas) were moved
  // to /brand — this nav only keeps app-level and account-level settings.
  const NAV_SECTIONS = [
    { id: 'perfil',         label: 'Perfil' },
    { id: 'tema',           label: 'Tema' },
    { id: 'idioma',         label: 'Idioma' },
    { id: 'notificaciones', label: t('sections.notifications') },
    { id: 'redes',          label: t('nav.social') },
    { id: 'exportar',       label: t('nav.export') },
    { id: 'plan',           label: t('nav.plan') },
    { id: 'cuenta',         label: t('nav.account') },
  ];

  const confirmWord = t('account.deleteConfirmWord');

  // Load user email + personal profile from Supabase on mount
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
      const meta = user?.user_metadata ?? {};
      if (meta.first_name) setFirstName(meta.first_name as string);
      if (meta.last_name)  setLastName(meta.last_name as string);
      if (typeof meta.show_name === 'boolean') setShowName(meta.show_name);
    });
  }, []);

  async function savePersonalProfile() {
    setSavingPersonal(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim() || null,
          last_name:  lastName.trim()  || null,
          show_name: showName,
        },
      });
      if (error) throw error;
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingPersonal(false);
    }
  }

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
    setNotifyPublish(brand.notify_email_publish ?? false);
    setNotifyComments(brand.notify_email_comments ?? false);
    setProfileLogo(brand.logo_url ?? null);
    setProfileDescription(brand.description ?? '');
    setProfileTimezone(brand.timezone ?? 'Europe/Madrid');
  }, [brand]);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Upload failed');
      setProfileLogo(json.url);
      toast.success('Logo subido');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error subiendo logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/brands', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          logo_url:    profileLogo,
          description: profileDescription || null,
          timezone:    profileTimezone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      updateBrand(json.brand);
      toast.success(t('account.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSavingProfile(false);
    }
  }

  // Common timezones — cover the main regions without being exhaustive.
  const TIMEZONES = [
    'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Europe/Lisbon', 'America/New_York', 'America/Mexico_City',
    'America/Bogota', 'America/Buenos_Aires', 'America/Santiago',
    'America/Lima', 'America/Caracas', 'America/Los_Angeles',
  ];

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

  async function connectMeta(source: 'instagram' | 'facebook') {
    try {
      const res  = await fetch(`/api/meta/oauth-url?source=${source}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo iniciar la conexión con Meta');
      if (!json.url) throw new Error('Meta no devolvió una URL de autorización');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la conexión con Meta');
    }
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
    <div className="page-content settings-blog-theme dashboard-unified-page">
      <div className="page-header dashboard-unified-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start' }}>

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
                    borderRadius: 0,
                    border: `1px solid ${activeSection === id ? 'var(--accent)' : 'transparent'}`,
                    background: activeSection === id ? 'var(--accent-light)' : 'transparent',
                    color: activeSection === id ? 'var(--accent)' : 'var(--muted)',
                    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
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
              border-radius: 0;
              border: 1px solid var(--border);
              background: #ffffff;
            }

            .notif-card-title {
              font-family: var(--font-barlow), 'Barlow', sans-serif;
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
              border-radius: 0;
              border: none;
              cursor: pointer;
              background: var(--border);
              position: relative;
              flex-shrink: 0;
              transition: background 0.2s;
            }

            .notif-switch.is-on {
              background: var(--accent);
            }

            .notif-switch-thumb {
              position: absolute;
              top: 3px;
              left: 3px;
              width: 18px;
              height: 18px;
              border-radius: 0;
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

          {/* ── Perfil personal ── */}
          <div id="perfil" className="settings-section">
            <h2 className="settings-section-title">Perfil personal</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20 }}>
              Tu nombre y preferencias de visibilidad en mensajes y comentarios.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Tu nombre"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>
                  Apellidos
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tus apellidos"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Show name toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid var(--border)', background: '#ffffff', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                  Mostrar mi nombre en mensajes y comentarios
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>
                  {showName
                    ? `Aparecerás como "${[firstName, lastName].filter(Boolean).join(' ') || 'Tu nombre'} · ${brand?.name ?? ''}"`
                    : `Aparecerás solo como "${brand?.name ?? 'Tu negocio'}"`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowName((v) => !v)}
                className={`notif-switch${showName ? ' is-on' : ''}`}
              >
                <span className="notif-switch-thumb" />
              </button>
            </div>

            <button
              type="button"
              onClick={savePersonalProfile}
              disabled={savingPersonal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', background: 'var(--accent)', color: '#ffffff', border: 'none', fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: savingPersonal ? 'wait' : 'pointer', opacity: savingPersonal ? 0.6 : 1 }}
            >
              <Save size={14} />{savingPersonal ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </div>

          {/* ── Perfil del negocio ── */}
          <div className="settings-section">
            <h2 className="settings-section-title">Perfil del negocio</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20 }}>
              La información que tu audiencia ve. El nombre y la ubicación se editan en el{' '}
              <a href="/brand" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Brand Kit</a>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
              {/* Logo uploader */}
              <div>
                <label
                  htmlFor="logo-upload"
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    width:          120,
                    height:         120,
                    border:         '1.5px dashed var(--border)',
                    background:     profileLogo ? '#ffffff' : 'var(--bg-1)',
                    cursor:         uploadingLogo ? 'wait' : 'pointer',
                    overflow:       'hidden',
                    position:       'relative',
                  }}
                >
                  {profileLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>📷</div>
                      <div style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11 }}>
                        {uploadingLogo ? 'Subiendo…' : 'Subir logo'}
                      </div>
                    </div>
                  )}
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    disabled={uploadingLogo}
                    aria-label="Subir logo"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                </label>
                {profileLogo && (
                  <button
                    type="button"
                    onClick={() => setProfileLogo(null)}
                    style={{
                      display: 'block',
                      marginTop: 6,
                      width: 120,
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                      fontSize: 11,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Quitar logo
                  </button>
                )}
              </div>

              {/* Description + timezone + summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="profile-desc">Descripción corta</label>
                    <textarea
                      id="profile-desc"
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value.slice(0, 160))}
                      placeholder="Ej: Heladería artesanal en el barrio gótico desde 1995."
                      rows={2}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                    <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {profileDescription.length}/160
                    </p>
                  </div>
                </div>

                <div style={{ margin: 0 }}>
                  <label style={{
                    display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6,
                    fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
                  }}>
                    Zona horaria
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      id="profile-tz"
                      value={profileTimezone}
                      onChange={(e) => setProfileTimezone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 44px 11px 14px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text-primary)',
                        fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        appearance: 'none',
                        cursor: 'pointer',
                        outline: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 14px center',
                        backgroundSize: '14px',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      {TIMEZONES.includes(profileTimezone) ? null : (
                        <option value={profileTimezone}>{profileTimezone}</option>
                      )}
                      {TIMEZONES.map((tz) => {
                        const [continent, city] = tz.split('/');
                        const label = city ? `${city.replace(/_/g, ' ')} (${continent})` : tz;
                        return <option key={tz} value={tz}>{label}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? <><span className="loading-spinner" />{t('saving')}</> : <><Save size={16} />Guardar perfil</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Tema ── */}
          <ThemeSection />

          {/* ── Idioma ── */}
          <LanguageSection />

          {/* ── Categorías de contenido ── */}
          <ContentCategoriesSection brandId={brand?.id} />

          {/* ── Notificaciones ── */}
          <div id="notificaciones" className="settings-section">
            <h2 className="settings-section-title notif-title-row">
              <Bell size={18} />{t('notifSection.title')}
            </h2>
            <p className="notif-subtitle">
              Elige qué emails quieres recibir. Los cambios se guardan automáticamente.
            </p>

            {(() => {
              // Default value when preferences row hasn't loaded yet. Marketing
              // family defaults to false at table level; reminder family to true.
              const get = (key: keyof NotifPrefs, fallback: boolean): boolean => {
                const v = prefs?.[key];
                if (typeof v === 'boolean') return v;
                return fallback;
              };

              // 'trial_ending_email' intentionally excluded — NeuroPost no
              // longer uses a trial period. Column kept in DB for future use.
              // Legacy 'notify_email_*' toggles removed; values migrated by
              // supabase/migrations/20260419_consolidate_notification_prefs.sql.
              const groups: Array<{
                id: string;
                title: string;
                icon: React.ComponentType<{ size?: number; color?: string }>;
                items: Array<{ key: keyof NotifPrefs; label: string; desc: string; defaultOn: boolean }>;
              }> = [
                {
                  id: 'action',
                  title: 'Acción requerida',
                  icon: AlertCircle,
                  items: [
                    { key: 'approval_needed_email',  label: 'Contenido listo para aprobar', desc: 'Cuando la IA genera un post que espera tu validación',      defaultOn: true },
                    { key: 'ticket_reply_email',     label: 'Respuestas de soporte',        desc: 'Cuando respondemos a uno de tus tickets',                   defaultOn: true },
                    { key: 'chat_message_email',     label: 'Mensajes del equipo',          desc: 'Cuando te escribimos por chat (solo si no lo lees en 24h)', defaultOn: true },
                    { key: 'recreation_ready_email', label: 'Recreaciones listas',          desc: 'Cuando una imagen recreada está lista para revisar',        defaultOn: true },
                    { key: 'comment_pending_email',  label: 'Comentarios pendientes',       desc: 'Comentarios en Instagram que llevan >24h sin responder',    defaultOn: false },
                  ],
                },
                {
                  id: 'technical',
                  title: 'Alertas técnicas',
                  icon: Wrench,
                  items: [
                    { key: 'token_expired_email',   label: 'Conexión caducada',    desc: 'Cuando IG/FB/TikTok desconectan tu cuenta',      defaultOn: true },
                    { key: 'post_published_email',  label: 'Post publicado',       desc: 'Cuando un post programado sale a tu red',        defaultOn: true },
                    { key: 'post_failed_email',     label: 'Fallo al publicar',    desc: 'Cuando un post programado no puede publicarse',  defaultOn: true },
                    { key: 'payment_failed_email',  label: 'Pago fallido',         desc: 'Cuando Stripe no puede cobrar tu suscripción',   defaultOn: true },
                    { key: 'limit_reached_email',   label: 'Límite alcanzado',     desc: 'Cuando agotas tu cuota semanal del plan',         defaultOn: true },
                  ],
                },
                {
                  id: 'reminders',
                  title: 'Recordatorios',
                  icon: Bell,
                  items: [
                    { key: 'reactivation_email',           label: 'Te echamos de menos',     desc: 'Cuando llevas 7, 14 o 30 días sin entrar',              defaultOn: true },
                    { key: 'no_content_email',             label: 'Sin contenido',            desc: 'Si llevas más de una semana con la biblioteca casi vacía', defaultOn: true },
                    { key: 'onboarding_incomplete_email',  label: 'Configuración pendiente',  desc: 'Si no terminaste de configurar tu marca',               defaultOn: true },
                    { key: 'no_social_connected_email',    label: 'Redes sin conectar',       desc: 'Si no has conectado ninguna red social',                defaultOn: true },
                    { key: 'plan_unused_email',            label: 'Plan sin usar',            desc: 'Si pagas un plan y llevas semanas sin publicar',         defaultOn: true },
                  ],
                },
                {
                  id: 'reports',
                  title: 'Resúmenes e informes',
                  icon: BarChart3,
                  items: [
                    { key: 'weekly_report_email',  label: 'Informe semanal',  desc: 'Cada lunes con los números de la semana pasada',       defaultOn: true },
                    { key: 'monthly_report_email', label: 'Informe mensual',  desc: 'El día 1 de cada mes con el resumen del mes anterior', defaultOn: true },
                    { key: 'daily_digest_email',   label: 'Resumen diario',   desc: 'Un email al día con todo lo que ha pasado',            defaultOn: false },
                  ],
                },
                {
                  id: 'marketing',
                  title: 'Marketing (opt-in)',
                  icon: Megaphone,
                  items: [
                    { key: 'marketing_email',       label: 'Comunicaciones comerciales', desc: 'Ofertas, descuentos y promociones',    defaultOn: false },
                    { key: 'product_updates_email', label: 'Novedades del producto',     desc: 'Cuando añadimos funciones nuevas',      defaultOn: false },
                    { key: 'newsletter_email',      label: 'Newsletter',                 desc: 'Consejos de redes sociales mensuales',  defaultOn: false },
                  ],
                },
              ];

              // Reusable accordion group shell — rendered below for each item
              // in `groups` plus the 'config' group (language + frequency).
              const renderGroup = (g: typeof groups[number]) => {
                const isOpen = openGroup === g.id;
                const Icon   = g.icon;
                const active = g.items.filter(i => get(i.key, i.defaultOn)).length;
                const total  = g.items.length;
                const counterColor =
                  active === 0     ? 'var(--text-tertiary)'
                  : active === total ? 'var(--accent)'
                  : 'var(--text-secondary)';
                const counterExtra = active === 0 ? { textDecoration: 'line-through' } as const : {};

                return (
                  <div key={g.id} className="pref-group">
                    <button
                      type="button"
                      className={`pref-group-head${isOpen ? ' is-open' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={`pref-content-${g.id}`}
                      onClick={() => toggleGroup(g.id)}
                    >
                      <span className="pref-group-head-left">
                        <Icon size={18} />
                        <span className="pref-group-title">{g.title}</span>
                      </span>
                      <span className="pref-group-head-right">
                        {savedPulse === g.id && (
                          <span className="pref-group-saved" aria-live="polite">✓ Guardado</span>
                        )}
                        <span className="pref-group-counter" style={{ color: counterColor, ...counterExtra }}>
                          {active} de {total} activos
                        </span>
                        <ChevronDown
                          size={18}
                          className="pref-group-chev"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}
                        />
                      </span>
                    </button>
                    <div
                      id={`pref-content-${g.id}`}
                      className={`pref-group-content${isOpen ? ' is-open' : ''}`}
                      aria-hidden={!isOpen}
                    >
                      <div className="pref-group-inner">
                        {g.items.map((item, idx) => {
                          const on = get(item.key, item.defaultOn);
                          const isLast = idx === g.items.length - 1;
                          return (
                            <div
                              key={item.key}
                              className={`pref-item${isLast ? ' is-last' : ''}`}
                            >
                              <div className="pref-item-text">
                                <p className="pref-item-title">{item.label}</p>
                                <p className="pref-item-desc">{item.desc}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={on ? 'true' : 'false'}
                                aria-label={item.label}
                                title={item.label}
                                onClick={() => updatePref(item.key, !on as never, g.id)}
                                className={`notif-switch ${on ? 'is-on' : ''}`}
                              >
                                <span className="notif-switch-thumb" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              };

              // Config group — rendered with its own content, not items.
              const configOpen = openGroup === 'config';

              return (
                <div className="pref-groups">
                  <style>{`
                    .pref-groups { display: flex; flex-direction: column; gap: 8px; }
                    .pref-group { border: 1px solid var(--border); background: var(--bg); }
                    .pref-group-head {
                      width: 100%;
                      display: flex; align-items: center; justify-content: space-between;
                      gap: 16px;
                      padding: 16px 20px;
                      background: var(--bg-2);
                      border: none;
                      border-left: 3px solid transparent;
                      cursor: pointer;
                      text-align: left;
                      transition: background 0.15s, border-color 0.15s;
                    }
                    .pref-group-head:hover { background: var(--bg-3); }
                    .pref-group-head.is-open { background: var(--bg-2); border-left-color: var(--accent); }
                    .pref-group-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
                    .pref-group-head-left {
                      display: flex; align-items: center; gap: 12px;
                      color: var(--accent);
                      min-width: 0;
                    }
                    .pref-group-title {
                      font-family: var(--font-barlow-condensed), sans-serif;
                      font-size: 14px; font-weight: 700;
                      text-transform: uppercase; letter-spacing: 0.08em;
                      color: var(--text-primary);
                      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    .pref-group-head-right {
                      display: flex; align-items: center; gap: 14px;
                      font-family: var(--font-barlow), sans-serif;
                    }
                    .pref-group-counter { font-size: 13px; white-space: nowrap; }
                    .pref-group-saved {
                      font-size: 11px; font-weight: 600; color: var(--accent);
                      animation: pref-fade 2s ease forwards;
                    }
                    @keyframes pref-fade {
                      0% { opacity: 0; transform: translateY(-2px); }
                      15% { opacity: 1; transform: translateY(0); }
                      80% { opacity: 1; }
                      100% { opacity: 0; }
                    }
                    .pref-group-chev { color: var(--text-tertiary); transition: transform 0.2s; }

                    .pref-group-content {
                      max-height: 0; overflow: hidden;
                      transition: max-height 300ms ease;
                    }
                    .pref-group-content.is-open { max-height: 2000px; }
                    .pref-group-inner { padding: 8px 20px 20px; }

                    .pref-item {
                      display: flex; align-items: center; gap: 16px;
                      padding: 14px 0;
                      border-bottom: 1px solid var(--border);
                    }
                    .pref-item.is-last { border-bottom: none; }
                    .pref-item-text { flex: 1; min-width: 0; }
                    .pref-item-title {
                      margin: 0 0 2px; font-weight: 600; font-size: 14px;
                      color: var(--text-primary);
                      font-family: var(--font-barlow), sans-serif;
                    }
                    .pref-item-desc {
                      margin: 0; font-size: 12px; color: var(--text-secondary);
                      line-height: 1.5; font-family: var(--font-barlow), sans-serif;
                    }

                    @media (max-width: 767px) {
                      .pref-group-head { flex-wrap: wrap; padding: 14px 16px; }
                      .pref-group-head-right { flex-wrap: wrap; gap: 10px; margin-left: 30px; }
                      .pref-group-counter { font-size: 12px; }
                      .pref-group-inner { padding: 8px 16px 18px; }
                      .pref-item { flex-direction: row; gap: 12px; }
                      .pref-item-title { font-size: 13px; }
                    }
                  `}</style>

                  {groups.map(renderGroup)}

                  {/* ── Configuration group (language + frequency) ── */}
                  <div className="pref-group">
                    <button
                      type="button"
                      className={`pref-group-head${configOpen ? ' is-open' : ''}`}
                      aria-expanded={configOpen}
                      aria-controls="pref-content-config"
                      onClick={() => toggleGroup('config')}
                    >
                      <span className="pref-group-head-left">
                        <SettingsIcon size={18} />
                        <span className="pref-group-title">Configuración</span>
                      </span>
                      <span className="pref-group-head-right">
                        {savedPulse === 'config' && (
                          <span className="pref-group-saved" aria-live="polite">✓ Guardado</span>
                        )}
                        <ChevronDown
                          size={18}
                          className="pref-group-chev"
                          style={{ transform: configOpen ? 'rotate(180deg)' : 'rotate(0)' }}
                        />
                      </span>
                    </button>
                    <div
                      id="pref-content-config"
                      className={`pref-group-content${configOpen ? ' is-open' : ''}`}
                      aria-hidden={!configOpen}
                    >
                      <div className="pref-group-inner">
                        {/* Language */}
                        <div className="form-group" style={{ marginBottom: 20 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Idioma de los emails
                          </label>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px', lineHeight: 1.5 }}>
                            Si lo dejas vacío, usamos el idioma de tu cuenta.
                          </p>
                          <select
                            value={prefs?.email_language ?? ''}
                            onChange={e => updatePref('email_language', e.target.value || null, 'config')}
                            style={{
                              width: '100%', padding: '10px 12px',
                              border: '1px solid var(--border)', background: 'var(--bg)',
                              color: 'var(--text-primary)', fontSize: 14,
                              fontFamily: 'var(--font-barlow), sans-serif',
                            }}
                          >
                            <option value="">Usar mi idioma de cuenta</option>
                            <option value="es">Español</option>
                            <option value="en">English</option>
                            <option value="fr">Français</option>
                            <option value="pt">Português</option>
                          </select>
                        </div>

                        {/* Frequency */}
                        <div className="form-group">
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Frecuencia máxima
                          </label>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px', lineHeight: 1.5 }}>
                            Con <em>diario</em> o <em>semanal</em> agrupamos los avisos en un único email.
                          </p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {([
                              { v: 'immediate', l: 'Al instante' },
                              { v: 'daily',     l: 'Resumen diario' },
                              { v: 'weekly',    l: 'Resumen semanal' },
                            ] as const).map(({ v, l }) => {
                              const active = (prefs?.max_frequency ?? 'immediate') === v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => updatePref('max_frequency', v, 'config')}
                                  style={{
                                    flex: 1, padding: '10px 12px',
                                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                                    background: active ? 'var(--accent)' : 'var(--bg)',
                                    color: active ? '#fff' : 'var(--text-secondary)',
                                    fontSize: 12, fontWeight: active ? 700 : 500,
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-barlow), sans-serif',
                                  }}
                                >
                                  {l}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Redes sociales ── */}
          <div id="redes" className="settings-section">
            <h2 className="settings-section-title">Redes sociales</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20 }}>
              Conecta tus cuentas de Instagram, Facebook y TikTok para publicar directamente desde NeuroPost.
            </p>

            {(() => {
              // Connection status derivation
              const igConnected = !!brand.ig_account_id;
              const fbConnected = !!brand.fb_page_id;
              const expiresAt   = brand.meta_token_expires_at ? new Date(brand.meta_token_expires_at) : null;
              const now         = new Date();
              const expired     = !!expiresAt && expiresAt.getTime() < now.getTime();
              const expiringSoon = !!expiresAt && !expired && (expiresAt.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;
              const lastSync    = brand.token_refreshed_at ? new Date(brand.token_refreshed_at) : null;

              const statusLabel = (connected: boolean) => {
                if (!connected) return { text: 'Sin conectar', color: '#9ca3af', bg: '#f3f4f6' };
                if (expired)    return { text: 'Expirado',     color: '#c62828', bg: '#ffebee' };
                if (expiringSoon) return { text: 'Caduca pronto', color: '#e65100', bg: '#fff3e0' };
                return { text: 'Conectado', color: '#2d7d32', bg: '#e8f5e9' };
              };

              const Card = ({
                name, detail, connected, onConnect, emoji, typeLabel, body,
              }: {
                name:     string;
                detail:   string | null;
                connected: boolean;
                onConnect: () => void;
                emoji:    string;
                typeLabel: string;
                body:     string;
              }) => {
                const status = statusLabel(connected);
                return (
                  <div style={{
                    border: '1px solid var(--border)', background: '#ffffff',
                    padding: '18px 20px', marginBottom: 12,
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>{emoji}</span>
                        <span style={{
                          fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
                          fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em',
                          color: 'var(--ink)',
                        }}>
                          {typeLabel}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '3px 8px', background: status.bg, color: status.color,
                        }}>
                          {status.text}
                        </span>
                      </div>
                      <p style={{
                        fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                        fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px',
                      }}>
                        {name}
                      </p>
                      {detail && (
                        <p style={{
                          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                          fontSize: 12, color: 'var(--muted)', margin: 0,
                        }}>
                          {detail}
                        </p>
                      )}
                      <p style={{
                        fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                        fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5,
                      }}>
                        {body}
                      </p>
                      {connected && lastSync && (
                        <p style={{
                          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                          fontSize: 11, color: '#9ca3af', marginTop: 6,
                        }}>
                          Última sincronización: {lastSync.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      )}
                      {connected && expiresAt && (
                        <p style={{
                          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                          fontSize: 11, color: expired ? '#c62828' : expiringSoon ? '#e65100' : '#9ca3af',
                          marginTop: 2,
                        }}>
                          Token {expired ? 'expiró' : 'caduca'} el {expiresAt.toLocaleDateString('es-ES', { dateStyle: 'medium' })}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={onConnect}
                      style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={14} />
                      {connected ? (expired || expiringSoon ? 'Reconectar' : 'Reautorizar') : 'Conectar'}
                    </button>
                  </div>
                );
              };

              const ttConnected = !!brand.tt_open_id;
              const ttUsername  = brand.tt_username;

              return (
                <>
                  <Card
                    emoji="📷"
                    typeLabel="Instagram"
                    name={igConnected ? `@${brand.ig_username ?? brand.ig_account_id}` : 'Instagram'}
                    detail={igConnected ? null : 'No hay ninguna cuenta vinculada todavía'}
                    connected={igConnected}
                    onConnect={() => connectMeta('instagram')}
                    body="Conecta tu cuenta Business o Creator para publicar fotos, vídeos, reels, carruseles e historias."
                  />
                  <Card
                    emoji="📘"
                    typeLabel="Facebook"
                    name={fbConnected ? (brand.fb_page_name ?? brand.fb_page_id ?? 'Página conectada') : 'Facebook'}
                    detail={fbConnected ? null : 'No hay ninguna página vinculada todavía'}
                    connected={fbConnected}
                    onConnect={() => connectMeta('facebook')}
                    body="Conecta tu Página de Facebook para publicar fotos, vídeos y posts de texto. Se enlaza con el mismo flujo que Instagram."
                  />
                  {/* TikTok — uses separate OAuth, not Meta */}
                  <div style={{
                    border: '1px solid var(--border)', background: '#ffffff',
                    padding: '18px 20px', marginBottom: 12,
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>🎵</span>
                        <span style={{
                          fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
                          fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em',
                          color: 'var(--ink)',
                        }}>TikTok</span>
                        <span style={{
                          fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '3px 8px',
                          background: ttConnected ? '#e8f5e9' : '#f3f4f6',
                          color: ttConnected ? '#2d7d32' : '#9ca3af',
                        }}>
                          {ttConnected ? 'Conectado' : 'Sin conectar'}
                        </span>
                      </div>
                      <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>
                        {ttConnected ? (ttUsername ? `@${ttUsername}` : 'Cuenta conectada') : 'TikTok'}
                      </p>
                      {!ttConnected && (
                        <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                          No hay ninguna cuenta vinculada todavía
                        </p>
                      )}
                      <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                        Conecta tu cuenta de TikTok para publicar vídeos y reels directamente. Solo compatible con formato vídeo (Business o Creator).
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/tiktok/auth-url');
                          const json = await res.json() as { url?: string; error?: string };
                          if (!res.ok || !json.url) throw new Error(json.error ?? 'No se pudo conectar con TikTok');
                          window.location.href = json.url;
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Error al conectar TikTok');
                        }
                      }}
                      style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={14} />
                      {ttConnected ? 'Reconectar' : 'Conectar'}
                    </button>
                  </div>
                </>
              );
            })()}
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
                  borderRadius:   0,
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
                  border:         '1.5px solid var(--accent)',
                  borderRadius:   0,
                  fontSize:       13,
                  fontWeight:     600,
                  color:          'var(--accent)',
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

            {/* Current plan card */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 12,
              background: 'var(--bg)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
                    fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.02em',
                    color: 'var(--text-primary)',
                  }}>
                    {PLAN_META[brand.plan].label}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '3px 10px', background: 'var(--accent)', color: '#fff',
                  }}>
                    ACTIVO
                  </span>
                  {brand.trial_ends_at && new Date(brand.trial_ends_at) > new Date() && (
                    <span style={{
                      fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                      fontSize: 11, fontWeight: 700, padding: '3px 10px',
                      background: '#e6f9f0', color: '#1a7a45', letterSpacing: '0.04em',
                    }}>
                      Prueba gratis
                    </span>
                  )}
                  {brand.plan_cancels_at && (
                    <span style={{
                      fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                      fontSize: 11, fontWeight: 700, padding: '3px 10px',
                      background: '#fff3e0', color: '#e65100',
                    }}>
                      Cancela el {new Date(brand.plan_cancels_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                <p style={{
                  fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                  fontSize: '0.84rem', color: 'var(--text-secondary)',
                }}>
                  {PLAN_META[brand.plan].tagline}
                </p>
              </div>
              <a
                href="/settings/plan"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  padding: '9px 18px', border: '1px solid var(--border)', background: 'var(--bg)',
                  fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 13, fontWeight: 600,
                  color: 'var(--text-primary)', textDecoration: 'none', cursor: 'pointer',
                }}
              >
                Cambiar plan →
              </a>
            </div>

            {/* Billing portal — only for existing Stripe subscribers */}
            {brand.stripe_customer_id && (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={billing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', border: '1px solid var(--border)', background: 'transparent',
                  fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontSize: 12, fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                {billing ? <span className="loading-spinner" /> : <ExternalLink size={13} />}
                Facturas y método de pago
              </button>
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
              <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 700, fontSize: '0.92rem', marginBottom: 12 }}>
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
              <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 700, fontSize: '0.92rem', color: '#dc2626', marginBottom: 8 }}>
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
                    padding: '9px 18px', borderRadius: 0, border: '1.5px solid #dc2626',
                    background: 'transparent', color: '#dc2626',
                    fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />{t('account.deleteAccount')}
                </button>
              ) : (
                <div style={{ padding: '16px 20px', borderRadius: 0, border: '1.5px solid #dc2626', background: '#fef2f2' }}>
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
                        padding: '8px 12px', borderRadius: 0, border: '1px solid #dc2626',
                        fontSize: '0.88rem', width: 160,
                      }}
                    />
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deletingAccount || deleteConfirm !== confirmWord}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 0, border: 'none',
                        background: deleteConfirm === confirmWord ? '#dc2626' : '#fca5a5',
                        color: '#fff',
                        fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 700,
                        fontSize: '0.85rem', cursor: deleteConfirm === confirmWord ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {deletingAccount ? <><span className="loading-spinner" />{t('account.deleting')}</> : <><Trash2 size={14} />{t('account.deleteConfirmBtn')}</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDeleteZone(false); setDeleteConfirm(''); }}
                      style={{
                        padding: '9px 14px', borderRadius: 0, border: '1px solid var(--border)',
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

          {/* ── Cerrar sesión ── */}
          <div className="settings-section" style={{ marginTop: 32 }}>
            <button
              type="button"
              onClick={async () => {
                const { createBrowserClient } = await import('@/lib/supabase');
                const supabase = createBrowserClient();
                await supabase.auth.signOut();
                window.location.href = '/';
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', border: '1px solid #d4d4d8',
                background: '#ffffff', color: '#6b7280',
                fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cerrar sesión
            </button>
          </div>

        </div>{/* end right content */}
      </div>{/* end two-column layout */}
    </div>
  );
}

// ─── Content categories section ──────────────────────────────────────────────

function ContentCategoriesSection({ brandId }: { brandId?: string }) {
  const [categories,  setCategories]  = useState<ContentCategory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [catInput,    setCatInput]    = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sugLoading,  setSugLoading]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandRef    = useRef<string | undefined>(brandId);
  brandRef.current  = brandId;

  // Load from API on mount
  useEffect(() => {
    if (!brandId) { setLoading(false); return; }
    setLoading(true);
    fetch('/api/brands/categories')
      .then((r) => r.json())
      .then((j) => { setCategories(j.categories ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId]);

  const toggleActive = useCallback((key: string) => {
    setCategories((prev) => prev.map((c) => c.category_key === key ? { ...c, active: !c.active } : c));
  }, []);

  const removeCategory = useCallback((key: string) => {
    setCategories((prev) => prev.filter((c) => c.category_key !== key));
  }, []);

  const addCategory = useCallback((label: string, source: 'user' | 'ai_suggested' = 'user') => {
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setCategories((prev) => {
      if (prev.some((c) => c.category_key === key)) return prev;
      return [...prev, { category_key: key, name: label, source, active: true }];
    });
  }, []);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const res  = await fetch('/api/ai/suggest-categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sector:             '', // not required for refinement
          current_categories: categories.map((c) => c.name),
          input:              value,
        }),
      });
      const json = await res.json();
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch { setSuggestions([]); }
    finally { setSugLoading(false); }
  }, [categories]);

  const handleInputChange = useCallback((value: string) => {
    setCatInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchSuggestions(value); }, 500);
  }, [fetchSuggestions]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/brands/categories', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ categories }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Categorías guardadas');
    } catch { toast.error('No se pudieron guardar las categorías'); }
    finally { setSaving(false); }
  }

  if (loading) return null;

  return (
    <div id="categorias" className="settings-section">
      <h2 className="settings-section-title">Categorías de contenido</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Define qué tipos de contenido publica NeuroPost para tu negocio. El agente validador de imágenes usa estas categorías para asegurarse de que cada imagen encaja con lo que quieres publicar.
      </p>

      {/* Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {categories.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No hay categorías. Añade la primera abajo.</p>
        )}
        {categories.map((cat) => (
          <div
            key={cat.category_key}
            style={{
              display:    'inline-flex', alignItems: 'center', gap: 6,
              padding:    '6px 10px',
              background: cat.active ? 'var(--accent)' : 'var(--bg-0, #f5f5f5)',
              color:      cat.active ? '#ffffff' : 'var(--ink)',
              border:     `1.5px solid ${cat.active ? 'var(--accent)' : 'var(--border)'}`,
              opacity:    cat.active ? 1 : 0.55,
              fontSize:   13, fontWeight: 700, cursor: 'default',
            }}
          >
            <button
              type="button"
              onClick={() => toggleActive(cat.category_key)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontWeight: 700, fontSize: 13 }}
            >
              {cat.name}
            </button>
            {cat.source === 'ai_suggested' && (
              <span style={{ fontSize: 9, opacity: 0.7 }}>✦ IA</span>
            )}
            <button
              type="button"
              onClick={() => removeCategory(cat.category_key)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, opacity: 0.6 }}
              aria-label={`Eliminar ${cat.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add new category input */}
      <div style={{ position: 'relative', maxWidth: 400 }}>
        <input
          className="form-input"
          type="text"
          placeholder="Añadir categoría… (pulsa Enter)"
          value={catInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && catInput.trim()) {
              e.preventDefault();
              addCategory(catInput.trim(), 'user');
              setCatInput('');
              setSuggestions([]);
            }
            if (e.key === 'Escape') setSuggestions([]);
          }}
        />
        {(suggestions.length > 0 || sugLoading) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--bg-0, #fff)', border: '1px solid var(--border)',
            borderTop: 'none', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}>
            {sugLoading && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>Buscando…</div>}
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { addCategory(s, 'ai_suggested'); setCatInput(''); setSuggestions([]); }}
                className="cat-suggest-item"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}
              >
                <span>{s}</span>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✦ IA</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar categorías'}
        </button>
      </div>
    </div>
  );
}

// ─── Theme section ───────────────────────────────────────────────────────────

const ff = "var(--font-barlow), 'Barlow', sans-serif";

function ThemeSection() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(saved ? saved === 'dark' : prefersDark);
  }, []);

  async function setTheme(isDark: boolean) {
    setDark(isDark);
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.auth.updateUser({ data: { theme } });
    } catch { /* non-blocking */ }
  }

  return (
    <div id="tema" className="settings-section">
      <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sun size={18} /> Tema
      </h2>
      <p style={{ fontFamily: ff, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        Elige cómo quieres ver NeuroPost.
      </p>
      <div style={{ display: 'flex', gap: 0, maxWidth: 300 }}>
        <button onClick={() => setTheme(false)} style={{
          flex: 1, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: !dark ? '#111827' : 'var(--bg)', color: !dark ? '#ffffff' : 'var(--text-tertiary)',
          border: `1px solid ${!dark ? '#111827' : 'var(--border)'}`, borderRight: 'none',
          fontFamily: ff, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          <Sun size={15} /> Claro
        </button>
        <button onClick={() => setTheme(true)} style={{
          flex: 1, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: dark ? '#111827' : 'var(--bg)', color: dark ? '#ffffff' : 'var(--text-tertiary)',
          border: `1px solid ${dark ? '#111827' : 'var(--border)'}`,
          fontFamily: ff, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          <Moon size={15} /> Oscuro
        </button>
      </div>
    </div>
  );
}

// ─── Language section ────────────────────────────────────────────────────────

function getStoredLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const raw = match?.[1];
  return (locales as readonly string[]).includes(raw ?? '') ? (raw as Locale) : defaultLocale;
}

function LanguageSection() {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    setCurrentLocale(getStoredLocale());
  }, []);

  async function changeLocale(loc: Locale) {
    document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; SameSite=Lax`;
    setCurrentLocale(loc);
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.auth.updateUser({ data: { locale: loc } });
    } catch { /* non-blocking */ }
    router.refresh();
  }

  return (
    <div id="idioma" className="settings-section">
      <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={18} /> Idioma
      </h2>
      <p style={{ fontFamily: ff, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        Selecciona el idioma de la interfaz.
      </p>
      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {locales.map((loc, i) => (
          <button key={loc} onClick={() => changeLocale(loc)} style={{
            padding: '12px 18px', fontFamily: ff, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: currentLocale === loc ? 'var(--accent)' : 'var(--bg)',
            color: currentLocale === loc ? '#ffffff' : 'var(--text-tertiary)',
            border: `1px solid ${currentLocale === loc ? 'var(--accent)' : 'var(--border)'}`,
            borderRight: i < locales.length - 1 ? 'none' : undefined,
            transition: 'all 0.15s',
          }}>
            {localeNames[loc]}
          </button>
        ))}
      </div>
    </div>
  );
}
