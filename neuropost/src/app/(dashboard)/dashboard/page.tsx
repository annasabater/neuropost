import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Calendar, Lightbulb, MessageSquare, Plus, Zap } from 'lucide-react';
import { getServerBrand, createServerClient } from '@/lib/supabase';
import { TrendsBanner } from '@/components/trends/TrendsBanner';
import DashboardTour from '@/components/onboarding/DashboardTour';
import IncidentBanner from '@/components/layout/IncidentBanner';
import ChangelogModal from '@/components/layout/ChangelogModal';
import { SeasonalChip } from '@/components/calendar/SeasonalPin';
import { getUpcomingDatesForBrand } from '@/agents/SeasonalAgent';
import { PLAN_LIMITS } from '@/types';
import InspirationTeaser from '@/components/inspiration/InspirationTeaser';

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

  const upcomingDates = getUpcomingDatesForBrand(allDates ?? [], brand.sector ?? 'otro', 30).slice(0, 3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('brands').update({ last_login_at: now.toISOString() }).eq('id', brand.id);

  return (
    <div className="page-content">
      <DashboardTour />
      <IncidentBanner />

      {/* ── Greeting — Apple-style large typography ── */}
      <div style={{ padding: '40px 0 32px' }}>
        <h1 style={{
          fontFamily: "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: '2.2rem',
          letterSpacing: '-0.04em',
          color: 'var(--text-primary)',
          marginBottom: 6,
          lineHeight: 1.1,
        }}>
          {t('greeting', { name: brand.name })}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: "var(--font-barlow), 'Barlow', sans-serif", lineHeight: 1.6 }}>
          {t('subtitle')}
          {pending > 0 && (
            <span style={{ color: 'var(--warning)' }}>
              {' · '}{pending} {t('metrics.pending')}
            </span>
          )}
        </p>
      </div>

      {/* ── Trends ── */}
      <TrendsBanner />

      {/* ── Metrics — Large numbers, no borders ── */}
      <div data-tour="dashboard-metrics" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 40,
      }}>
        {[
          { label: t('metrics.published'), value: String(publishedThisMonth) },
          { label: t('metrics.scheduled'), value: String(scheduled) },
          { label: t('metrics.pending'),   value: String(pending) },
          { label: t('metrics.plan'),      value: brand.plan, capitalize: true },
        ].map(({ label, value, capitalize }) => (
          <div key={label} style={{
            background: 'var(--bg-2)',
            borderRadius: 16,
            padding: 24,
            transition: 'transform 0.2s',
          }}>
            <p style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 900,
              fontSize: '2.4rem',
              letterSpacing: '-0.05em',
              color: 'var(--text-primary)',
              lineHeight: 1,
              textTransform: capitalize ? 'capitalize' : undefined,
            }}>
              {value}
            </p>
            <p style={{
              fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginTop: 4,
            }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Plan usage — subtle bar ── */}
      {!isUnlimited && (
        <div style={{
          background: 'var(--bg-2)',
          borderRadius: 16,
          padding: '16px 20px',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 500, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              {t('sections.planUsage')}
            </span>
            <span style={{ fontSize: 13, color: pct >= 80 ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 500, fontFamily: "var(--font-barlow), 'Barlow', sans-serif" }}>
              {publishedThisMonth} / {planLimit}
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-4)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 2,
              background: pct >= 100 ? 'var(--error)' : pct >= 80 ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          {pct >= 80 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>
                {pct >= 100 ? t('planLimit.limitReached') : t('planLimit.nearLimit', { remaining: planLimit - publishedThisMonth })}
              </p>
              <Link href="/settings/plan" className="btn-primary btn-orange" style={{ fontSize: 12, padding: '6px 16px' }}>
                {t('planLimit.upgrade')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming dates ── */}
      {upcomingDates.length > 0 && (
        <>
          <h2 className="section-title">{t('sections.upcomingDates')}</h2>
          <div style={{ marginBottom: 32 }}>
            {upcomingDates.map((d) => (
              <SeasonalChip key={d.id} name={d.name} daysUntil={d.daysUntil} hasPost={false} onGenerate={undefined} />
            ))}
          </div>
        </>
      )}

      {/* ── Quick actions ── */}
      <h2 className="section-title">{t('sections.quickActions')}</h2>
      <div className="quick-actions" style={{ marginBottom: 32 }}>
        {[
          { href: '/posts/new',  icon: Plus,          label: t('actions.newPost') },
          { href: '/ideas',      icon: Lightbulb,     label: t('actions.generateIdeas') },
          { href: '/calendar',   icon: Calendar,      label: t('actions.planMonth') },
          { href: '/tendencias', icon: Zap,           label: t('actions.trends') },
          { href: '/comments',   icon: MessageSquare, label: t('actions.community') },
          { href: '/analytics',  icon: BarChart3,     label: t('actions.analytics') },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="quick-action-card">
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <InspirationTeaser />

      {/* ── Pending alert ── */}
      {pending > 0 && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 16,
          background: 'var(--accent-soft)',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <p style={{ fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--accent)', marginBottom: 2 }}>
              {pending} {t('metrics.pending')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "var(--font-barlow), 'Barlow', sans-serif" }}>
              {t('sections.pendingSubtitle')}
            </p>
          </div>
          <Link href="/posts" className="btn-primary btn-orange" style={{ whiteSpace: 'nowrap' }}>
            {t('sections.pendingAction')}
          </Link>
        </div>
      )}

      {/* ── Recent posts ── */}
      {allPosts.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ margin: '0 0 16px' }}>{t('sections.recentPosts')}</h2>
            <Link href="/posts" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none', fontFamily: "var(--font-barlow), 'Barlow', sans-serif", fontWeight: 500 }}>
              Veure tot →
            </Link>
          </div>
          <div className="posts-list">
            {allPosts.map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="post-list-item post-list-link">
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image_url} alt="" className="post-list-thumb" />
                ) : (
                  <div className="post-list-thumb-placeholder">📸</div>
                )}
                <div className="post-list-info">
                  <p className="post-list-caption">
                    {post.caption ? `${post.caption.slice(0, 80)}…` : '—'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    {post.quality_score != null && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: post.quality_score >= 8 ? 'var(--success)' : post.quality_score >= 6 ? 'var(--warning)' : 'var(--error)',
                        fontFamily: "var(--font-barlow), 'Barlow', sans-serif",
                      }}>
                        ★ {post.quality_score}
                      </span>
                    )}
                  </div>
                </div>
                <span className="post-list-date">
                  {new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {allPosts.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon">📸</div>
          <p className="empty-state-title">{t('empty.noPosts')}</p>
          <p className="empty-state-sub">{t('empty.noPostsSub')}</p>
          <Link href="/ideas" className="btn-primary btn-orange">{t('empty.generateIdeas')}</Link>
        </div>
      )}

      <ChangelogModal />
    </div>
  );
}
