'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft }           from 'lucide-react';
import toast                   from 'react-hot-toast';
import { useAppStore }         from '@/store/useAppStore';
import { PLAN_CONTENT_QUOTAS, type PlanKey } from '@/lib/plan-limits';
import { PLAN_META }           from '@/types';
import type { SubscriptionPlan } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

function getPlanKey(plan: SubscriptionPlan | undefined): PlanKey {
  if (plan === 'pro' || plan === 'total') return plan;
  return 'starter';
}

export default function ContentSettingsPage() {
  const brand    = useAppStore((s) => s.brand);
  const setBrand = useAppStore((s) => s.setBrand);

  const planKey  = getPlanKey(brand?.plan as SubscriptionPlan | undefined);
  const quota    = PLAN_CONTENT_QUOTAS[planKey];
  const planMeta = PLAN_META[planKey as SubscriptionPlan] ?? PLAN_META['starter'];

  // Saved preferences from brand, or defaults
  const savedCarousel = (brand?.content_mix_preferences as { posts?: { carousel?: number; reel?: number } } | undefined)?.posts?.carousel;
  const savedReel     = (brand?.content_mix_preferences as { posts?: { carousel?: number; reel?: number } } | undefined)?.posts?.reel;

  const defaultCarousel = quota.posts_per_week; // all posts as carousel by default
  const defaultReel     = 0;

  const [carousel, setCarousel] = useState<number>(savedCarousel ?? defaultCarousel);
  const [reel,     setReel]     = useState<number>(savedReel     ?? defaultReel);
  const [saving,   setSaving]   = useState(false);

  // Re-sync when brand loads
  useEffect(() => {
    const prefs = brand?.content_mix_preferences as { posts?: { carousel?: number; reel?: number } } | undefined;
    if (prefs?.posts) {
      setCarousel(prefs.posts.carousel ?? defaultCarousel);
      setReel(prefs.posts.reel     ?? defaultReel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id]);

  const total        = carousel + reel;
  const sumOk        = total === quota.posts_per_week;
  const canConfigure = quota.posts_mix_configurable;

  function handleCarouselChange(val: number) {
    const clamped = Math.max(0, Math.min(val, quota.posts_per_week));
    setCarousel(clamped);
    if (canConfigure) setReel(quota.posts_per_week - clamped);
  }

  function handleReelChange(val: number) {
    const clamped = Math.max(0, Math.min(val, quota.posts_per_week));
    setReel(clamped);
    if (canConfigure) setCarousel(quota.posts_per_week - clamped);
  }

  async function handleSave() {
    if (!brand?.id) return;
    if (!sumOk) {
      toast.error(`La suma debe ser ${quota.posts_per_week}. Ahora tienes ${total}.`);
      return;
    }
    setSaving(true);
    try {
      const body = { posts: { carousel, reel } };
      const res  = await fetch(`/api/client/brands/${brand.id}/content-mix-preferences`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; errors?: string[]; error?: string };

      if (!res.ok) {
        const msg = json.errors?.join(' · ') ?? json.error ?? 'Error al guardar';
        toast.error(msg);
        return;
      }

      // Update store
      setBrand({ ...brand, content_mix_preferences: body } as typeof brand);
      toast.success('Preferencias guardadas. Se aplicarán al próximo plan semanal.');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 640, color: 'var(--text-primary)', fontFamily: f }}>

      {/* Back */}
      <a
        href="/settings"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
          padding: '7px 14px', border: '1px solid var(--border)', background: 'var(--bg-1)',
          fontFamily: f, marginBottom: 28,
        }}
      >
        <ArrowLeft size={14} /> Ajustes
      </a>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1,
        }}>
          Mix de contenido
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
          Tu plan <strong style={{ color: 'var(--text-primary)' }}>{planMeta.label}</strong> incluye{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{quota.posts_per_week} posts</strong> y{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{quota.stories_per_week} historias</strong> cada semana.
          Las preferencias se aplican al siguiente plan generado.
        </p>
      </div>

      {/* Mix card */}
      <div style={{ border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 24 }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-1)',
        }}>
          <span style={{
            fontFamily: fc, fontWeight: 800, fontSize: 13,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--text-secondary)',
          }}>
            Distribución de posts por formato
          </span>
        </div>

        <div style={{ padding: '24px 20px' }}>
          {!canConfigure ? (
            /* Non-configurable plan — starter */
            <div style={{
              padding: '16px 20px',
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Tu plan incluye{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{quota.posts_per_week} carruseles</strong> por semana,
                sin posibilidad de elegir. Para personalizar el mix, mejora tu plan.
              </span>
            </div>
          ) : (
            /* Configurable plan — pro / total */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Carousel */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Carrusel</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>posts estáticos / multi-imagen</span>
                  </div>
                  <span style={{
                    fontFamily: fc, fontWeight: 900, fontSize: 28, lineHeight: 1,
                    color: 'var(--accent)', minWidth: 32, textAlign: 'right',
                  }}>
                    {carousel}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={quota.posts_per_week}
                  value={carousel}
                  onChange={(e) => handleCarouselChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>0</span>
                  <span>{quota.posts_per_week}</span>
                </div>
              </div>

              {/* Reel */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Reel</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>vídeo corto vertical</span>
                  </div>
                  <span style={{
                    fontFamily: fc, fontWeight: 900, fontSize: 28, lineHeight: 1,
                    color: '#8b5cf6', minWidth: 32, textAlign: 'right',
                  }}>
                    {reel}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={quota.posts_per_week}
                  value={reel}
                  onChange={(e) => handleReelChange(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#8b5cf6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>0</span>
                  <span>{quota.posts_per_week}</span>
                </div>
              </div>

              {/* Sum indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                background: sumOk ? '#d1fae5' : '#fee2e2',
                border: `1px solid ${sumOk ? '#6ee7b7' : '#fca5a5'}`,
              }}>
                <span style={{
                  fontFamily: fc, fontWeight: 900, fontSize: 22,
                  color: sumOk ? '#065f46' : '#991b1b', lineHeight: 1,
                }}>
                  {total}/{quota.posts_per_week}
                </span>
                <span style={{ fontSize: 13, color: sumOk ? '#065f46' : '#991b1b' }}>
                  {sumOk
                    ? `Perfecto — ${carousel} carruseles + ${reel} reels cada semana`
                    : `La suma debe ser exactamente ${quota.posts_per_week}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stories info (Sprint 13 builder) */}
      <div style={{
        padding: '16px 20px', border: '1px solid var(--border)',
        background: 'var(--bg-1)', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>📱</span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 2 }}>
            {quota.stories_per_week} historias / semana
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {quota.stories_builder
              ? 'La configuración de templates de historias estará disponible próximamente.'
              : 'Tu plan no incluye el constructor de historias.'}
          </span>
        </div>
      </div>

      {/* Save button */}
      {canConfigure && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !sumOk}
          style={{
            padding: '14px 32px',
            background: saving || !sumOk ? 'var(--border)' : 'var(--accent)',
            color: saving || !sumOk ? 'var(--text-secondary)' : '#fff',
            border: 'none',
            cursor: saving || !sumOk ? 'not-allowed' : 'pointer',
            fontFamily: fc, fontWeight: 900,
            fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em',
            opacity: saving ? 0.7 : 1,
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      )}
    </div>
  );
}
