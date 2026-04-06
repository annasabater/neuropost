import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Calendar, Image, Lightbulb, MessageSquare, TrendingUp, Plus, Zap, CheckCircle2, Clock } from 'lucide-react';
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

  // Run independent queries in parallel
  const [{ data: posts }, { data: allDates }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, caption, status, published_at, created_at, quality_score')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(5),
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

  // Plan usage
  const planLimit  = PLAN_LIMITS[brand.plan].postsPerMonth;
  const isUnlimited = planLimit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((publishedThisMonth / planLimit) * 100));

  const upcomingDates = getUpcomingDatesForBrand(allDates ?? [], brand.sector ?? 'otro', 30).slice(0, 3);

  // Track last login (fire and forget)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('brands').update({ last_login_at: now.toISOString() }).eq('id', brand.id);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">{t('greeting', { name: brand.name })}</h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
        <Link href="/posts/new" className="btn-primary btn-orange" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> {t('actions.newPost')}
        </Link>
      </div>

      <DashboardTour />

      <IncidentBanner />

      {/* Trends banner */}
      <TrendsBanner />

      {/* Stats */}
      <div className="stats-grid" data-tour="dashboard-metrics">
        <div className="stat-card">
          <Image size={22} className="stat-icon" />
          <div>
            <p className="stat-label">{t('metrics.published')}</p>
            <p className="stat-value">{publishedThisMonth}</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={22} className="stat-icon" />
          <div>
            <p className="stat-label">{t('metrics.scheduled')}</p>
            <p className="stat-value">{scheduled}</p>
          </div>
        </div>
        {pending > 0 && (
          <div className="stat-card" style={{ border: '1px solid var(--orange)', background: 'var(--orange-light)' }}>
            <CheckCircle2 size={22} className="stat-icon" style={{ color: 'var(--orange)' }} />
            <div>
              <p className="stat-label">{t('metrics.pending')}</p>
              <p className="stat-value" style={{ color: 'var(--orange)' }}>{pending}</p>
            </div>
          </div>
        )}
        <div className="stat-card">
          <TrendingUp size={22} className="stat-icon" />
          <div>
            <p className="stat-label">{t('metrics.plan')}</p>
            <p className="stat-value" style={{ textTransform: 'capitalize' }}>{brand.plan}</p>
          </div>
        </div>
      </div>

      {/* Plan usage bar — only for starter */}
      {!isUnlimited && (
        <div className="settings-section" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.88rem' }}>
              {t('sections.planUsage')}
            </span>
            <span style={{ fontSize: '0.82rem', color: pct >= 80 ? '#dc2626' : 'var(--muted)', fontWeight: 600 }}>
              {publishedThisMonth} / {planLimit} posts
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${pct}%`,
              borderRadius: 6,
              background:  pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : 'var(--orange)',
              transition:  'width 0.4s ease',
            }} />
          </div>
          {pct >= 80 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>
                {pct >= 100
                  ? t('planLimit.limitReached')
                  : t('planLimit.nearLimit', { remaining: planLimit - publishedThisMonth })}
              </p>
              <Link href="/settings/plan" className="btn-primary btn-orange" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                {t('planLimit.upgrade')}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Upcoming seasonal dates */}
      {upcomingDates.length > 0 && (
        <>
          <h2 className="section-title">{t('sections.upcomingDates')}</h2>
          <div style={{ marginBottom: 24 }}>
            {upcomingDates.map((d) => (
              <SeasonalChip
                key={d.id}
                name={d.name}
                daysUntil={d.daysUntil}
                hasPost={false}
                onGenerate={undefined}
              />
            ))}
          </div>
        </>
      )}

      {/* Quick actions */}
      <h2 className="section-title">{t('sections.quickActions')}</h2>
      <div className="quick-actions">
        <Link href="/posts/new" className="quick-action-card">
          <Plus size={24} />
          <span>{t('actions.newPost')}</span>
        </Link>
        <Link href="/ideas" className="quick-action-card">
          <Lightbulb size={24} />
          <span>{t('actions.generateIdeas')}</span>
        </Link>
        <Link href="/calendar" className="quick-action-card">
          <Calendar size={24} />
          <span>{t('actions.planMonth')}</span>
        </Link>
        <Link href="/tendencias" className="quick-action-card">
          <Zap size={24} />
          <span>{t('actions.trends')}</span>
        </Link>
        <Link href="/comments" className="quick-action-card">
          <MessageSquare size={24} />
          <span>{t('actions.community')}</span>
        </Link>
        <Link href="/analytics" className="quick-action-card">
          <BarChart3 size={24} />
          <span>{t('actions.analytics')}</span>
        </Link>
      </div>

      <InspirationTeaser />

      {/* Pending posts alert */}
      {pending > 0 && (
        <div style={{
          padding:      '16px 20px',
          borderRadius: 12,
          background:   'var(--orange-light)',
          border:       '1px solid var(--orange)',
          marginBottom: 24,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          gap:          16,
        }}>
          <div>
            <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, color: 'var(--orange)', marginBottom: 2 }}>
              {pending} {t('metrics.pending')}
            </p>
            <p style={{ fontSize: '0.83rem', color: 'var(--ink)' }}>
              {t('sections.pendingSubtitle')}
            </p>
          </div>
          <Link href="/posts" className="btn-primary btn-orange" style={{ whiteSpace: 'nowrap' }}>
            {t('sections.pendingAction')}
          </Link>
        </div>
      )}

      {/* Recent posts */}
      {allPosts.length > 0 && (
        <>
          <h2 className="section-title">{t('sections.recentPosts')}</h2>
          <div className="posts-list">
            {allPosts.map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="post-list-item post-list-link">
                <div className="post-list-info">
                  <p className="post-list-caption">
                    {post.caption ? `${post.caption.slice(0, 90)}…` : '—'}
                  </p>
                  <span className={`status-badge status-${post.status}`}>{post.status}</span>
                  {post.quality_score != null && (
                    <span style={{
                      fontSize:   '0.72rem',
                      fontWeight: 700,
                      color:      post.quality_score >= 8 ? '#16a34a' : post.quality_score >= 6 ? '#d97706' : '#dc2626',
                    }}>
                      ★ {post.quality_score}/10
                    </span>
                  )}
                </div>
                <span className="post-list-date">
                  {new Date(post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {allPosts.length === 0 && (
        <div className="empty-state" style={{ marginTop: 28 }}>
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
