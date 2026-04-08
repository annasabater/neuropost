import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Calendar, Lightbulb, MessageSquare, Plus, Zap, ArrowRight, ChevronRight } from 'lucide-react';
import { getServerBrand, createServerClient } from '@/lib/supabase';
import { TrendsBanner } from '@/components/trends/TrendsBanner';
import DashboardTour from '@/components/onboarding/DashboardTour';
import IncidentBanner from '@/components/layout/IncidentBanner';
import ChangelogModal from '@/components/layout/ChangelogModal';

import { getUpcomingDatesForBrand } from '@/agents/SeasonalAgent';
import { PLAN_LIMITS } from '@/types';
import InspirationTeaser from '@/components/inspiration/InspirationTeaser';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default async function DashboardPage() {
  const brand = await getServerBrand();
  if (!brand) redirect('/onboarding');

  const supabase = await createServerClient();
  const now = new Date();
  const t = await getTranslations('dashboard');

  const [{ data: posts }, { data: allDates }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, caption, status, published_at, created_at, quality_score, image_url')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(6),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('seasonal_dates').select('*'),
  ]);

  const allPosts = posts ?? [];
  const publishedThisMonth = allPosts.filter((p) => {
    if (!p.published_at) return false;
    const d = new Date(p.published_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const scheduled = allPosts.filter((p) => p.status === 'scheduled').length;
  const pending   = allPosts.filter((p) => p.status === 'pending' || p.status === 'generated').length;
  const planLimit  = PLAN_LIMITS[brand.plan].postsPerMonth;
  const isUnlimited = planLimit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((publishedThisMonth / planLimit) * 100));
  const upcomingDates = getUpcomingDatesForBrand(allDates ?? [], brand.sector ?? 'otro', 30).slice(0, 5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('brands').update({ last_login_at: now.toISOString() }).eq('id', brand.id);

  return (
    <div className="page-content" style={{ maxWidth: 1000 }}>
      <DashboardTour />
      <IncidentBanner />

      {/* ── Greeting ── */}
      <div style={{ padding: '48px 0 40px' }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900,
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          textTransform: 'uppercase', letterSpacing: '0.01em',
          color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12,
        }}>
          {t('greeting', { name: brand.name })}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
          {t('subtitle')}
          {pending > 0 && (
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {' — '}{pending} {t('metrics.pending')}
            </span>
          )}
        </p>
      </div>

      <TrendsBanner />

      {/* ── Metrics — Nike 1px gap grid ── */}
      <div data-tour="dashboard-metrics" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
        background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 48,
      }}>
        {[
          { label: t('metrics.published'), value: String(publishedThisMonth) },
          { label: t('metrics.scheduled'), value: String(scheduled) },
          { label: t('metrics.pending'),   value: String(pending) },
          { label: t('metrics.plan'),      value: brand.plan, capitalize: true },
        ].map(({ label, value, capitalize }) => (
          <div key={label} style={{
            background: 'var(--bg)', padding: '28px 24px',
            transition: 'background 0.15s',
          }}>
            <p style={{
              fontFamily: fc, fontWeight: 900, fontSize: '3rem',
              letterSpacing: '-0.02em', lineHeight: 1,
              color: 'var(--text-primary)',
              textTransform: capitalize ? 'capitalize' : 'none',
            }}>
              {value}
            </p>
            <p style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--text-tertiary)', marginTop: 8,
            }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Plan usage ── */}
      {!isUnlimited && (
        <div style={{
          border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 48,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: f, fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              {t('sections.planUsage')}
            </span>
            <span style={{ fontSize: 13, color: pct >= 80 ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 500, fontFamily: f }}>
              {publishedThisMonth} / {planLimit}
            </span>
          </div>
          <div style={{ height: 2, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct >= 100 ? 'var(--error)' : pct >= 80 ? 'var(--warning)' : 'var(--text-primary)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          {pct >= 80 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: 'var(--error)', fontWeight: 500, fontFamily: f }}>
                {pct >= 100 ? t('planLimit.limitReached') : t('planLimit.nearLimit', { remaining: planLimit - publishedThisMonth })}
              </p>
              <Link href="/settings/plan" style={{
                fontSize: 12, fontFamily: fc, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--text-primary)', textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}>
                {t('planLimit.upgrade')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming dates — horizontal scroll ── */}
      {upcomingDates.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--text-tertiary)', margin: 0,
              paddingBottom: 8, borderBottom: '1px solid var(--border)',
            }}>
              {t('sections.upcomingDates')}
            </h2>
          </div>
          <div style={{
            display: 'flex', gap: '1px', background: 'var(--border)',
            border: '1px solid var(--border)', marginBottom: 48,
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {upcomingDates.map((d) => (
              <div key={d.id} style={{
                background: 'var(--bg)', padding: '16px 20px',
                minWidth: 180, flex: '0 0 auto',
              }}>
                <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {d.name}
                </p>
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  en {d.daysUntil} días
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Quick actions — 3x2 grid ── */}
      <h2 style={{
        fontFamily: f, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.14em',
        color: 'var(--text-tertiary)', marginBottom: 16,
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        {t('sections.quickActions')}
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
        background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 48,
      }}>
        {[
          { href: '/posts/new',  icon: Plus,          label: t('actions.newPost') },
          { href: '/ideas',      icon: Lightbulb,     label: t('actions.generateIdeas') },
          { href: '/calendar',   icon: Calendar,      label: t('actions.planMonth') },
          { href: '/tendencias', icon: Zap,           label: t('actions.trends') },
          { href: '/comments',   icon: MessageSquare, label: t('actions.community') },
          { href: '/analytics',  icon: BarChart3,     label: t('actions.analytics') },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} style={{
            background: 'var(--bg)', padding: '24px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            textDecoration: 'none', color: 'var(--text-primary)',
            fontFamily: f, fontSize: 13, fontWeight: 600,
            transition: 'background 0.15s',
          }}>
            <Icon size={18} style={{ color: 'var(--text-tertiary)' }} />
            <span>{label}</span>
            <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
          </Link>
        ))}
      </div>

      <InspirationTeaser />

      {/* ── Pending alert ── */}
      {pending > 0 && (
        <div style={{
          padding: '16px 20px', border: '1px solid var(--border)',
          marginBottom: 48, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
              {pending} {t('metrics.pending')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: f }}>
              {t('sections.pendingSubtitle')}
            </p>
          </div>
          <Link href="/posts" style={{
            fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--bg)', background: 'var(--text-primary)',
            padding: '10px 24px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'opacity 0.15s', whiteSpace: 'nowrap',
          }}>
            {t('sections.pendingAction')} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Recent posts ── */}
      {allPosts.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <h2 style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--text-tertiary)', margin: 0,
            }}>
              {t('sections.recentPosts')}
            </h2>
            <Link href="/posts" style={{
              fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none',
              fontFamily: f, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Ver todo →
            </Link>
          </div>
          <div style={{ border: '1px solid var(--border)', marginBottom: 48 }}>
            {allPosts.map((post, i) => (
              <Link key={post.id} href={`/posts/${post.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 20px', textDecoration: 'none', color: 'inherit',
                borderBottom: i < allPosts.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.15s',
              }}>
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    📸
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.caption ? `${post.caption.slice(0, 80)}…` : '—'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    {post.quality_score != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 500, fontFamily: f,
                        color: post.quality_score >= 8 ? 'var(--success)' : post.quality_score >= 6 ? 'var(--warning)' : 'var(--error)',
                      }}>
                        ★ {post.quality_score}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {allPosts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px', marginTop: 40 }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>
            {t('empty.noPosts')}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 32, fontFamily: f }}>
            {t('empty.noPostsSub')}
          </p>
          <Link href="/ideas" style={{
            fontFamily: fc, fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: 'var(--text-primary)', color: 'var(--bg)',
            padding: '14px 32px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {t('empty.generateIdeas')} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <ChangelogModal />
    </div>
  );
}
