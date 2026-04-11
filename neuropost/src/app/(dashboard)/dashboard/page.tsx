import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Calendar, Lightbulb, MessageSquare, Plus, Zap, ArrowRight, ChevronRight, Sparkles, Send, Paintbrush } from 'lucide-react';
import { getServerBrand, createServerClient } from '@/lib/supabase';
import { TrendsBanner } from '@/components/trends/TrendsBanner';
import DashboardTour from '@/components/onboarding/DashboardTour';
import IncidentBanner from '@/components/layout/IncidentBanner';
import ChangelogModal from '@/components/layout/ChangelogModal';
import { WeeklyProposals } from '@/components/dashboard/WeeklyProposals';

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

  // Get start of current week (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const [{ data: posts }, { data: publishedPosts }, { data: weeklyProposals }, { data: allDates }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, caption, status, published_at, created_at, quality_score, image_url')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('posts')
      .select('id, caption, status, published_at, created_at, quality_score, image_url')
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(6),
    // Weekly auto-proposals: posts created this week with ai_proposal origin
    supabase
      .from('posts')
      .select('id, caption, status, created_at, quality_score, image_url, format, ai_explanation')
      .eq('brand_id', brand.id)
      .in('status', ['generated', 'pending', 'approved', 'scheduled'])
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('seasonal_dates').select('*'),
  ]);

  const allPosts = posts ?? [];
  const recentPublishedPosts = publishedPosts ?? [];
  const proposalPosts = weeklyProposals ?? [];
  const publishedThisMonth = allPosts.filter((p) => {
    if (!p.published_at) return false;
    const d = new Date(p.published_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const scheduled = allPosts.filter((p) => p.status === 'scheduled').length;
  const pending   = allPosts.filter((p) => p.status === 'pending' || p.status === 'generated').length;

  const limits = PLAN_LIMITS[brand.plan];
  const planLimit = limits.postsPerMonth;
  const isUnlimited = planLimit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((publishedThisMonth / planLimit) * 100));
  const dbDates = getUpcomingDatesForBrand(allDates ?? [], brand.sector ?? 'otro', 30).slice(0, 5);

  // Static upcoming dates for Catalunya
  const STATIC_DATES = [
    { name: 'Sant Jordi', date: '2026-04-23', idea: 'Contingut emocional amb roses i llibres. Packs especials.' },
    { name: 'Dia de la Mare', date: '2026-05-03', idea: 'Promociona regals i experiències. Crea urgència.' },
    { name: 'Rebaixes d\'estiu', date: '2026-07-01', idea: 'Ofertes flash, countdown, productes d\'estiu.' },
    { name: 'La Mercè', date: '2026-09-24', idea: 'Contingut vinculat a la festa major de Barcelona.' },
    { name: 'Black Friday', date: '2026-11-27', idea: 'Ofertes exclusives amb anticipació. Estoc limitat.' },
    { name: 'Nadal', date: '2026-12-15', idea: 'Campanya nadalenca. Regals, packs, contingut càlid.' },
  ];
  const todayStr = now.toISOString().slice(0, 10);
  const staticUpcoming = STATIC_DATES
    .filter(d => d.date > todayStr)
    .map(d => ({ id: d.date, name: d.name, daysUntil: Math.ceil((new Date(d.date).getTime() - now.getTime()) / 86400000), idea: d.idea }))
    .slice(0, 4);

  const allUpcoming = [...dbDates.map(d => ({ ...d, idea: undefined as string | undefined })), ...staticUpcoming];
  const seen = new Set<string>();
  const upcomingDates = allUpcoming.filter(d => { if (seen.has(d.name)) return false; seen.add(d.name); return true; }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 4);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('brands').update({ last_login_at: now.toISOString() }).eq('id', brand.id);

  return (
    <div className="page-content dashboard-page">
      <div className="dashboard-tour-section">
        <div className="dashboard-inner">
          <DashboardTour />
        </div>
      </div>

      <div className="dashboard-summary-section">
        <div className="dashboard-inner">
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
      </div>

      </div>

      <div className="dashboard-inner">

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

      {/* ══════════════════════════════════════════════════════════════════════
           3 MODES — Content Hub
         ══════════════════════════════════════════════════════════════════════ */}
      <h2 style={{
        fontFamily: f, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.14em',
        color: 'var(--accent)', marginBottom: 16,
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        {t('sections.contentHub')}
      </h2>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
        background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 48,
      }}>
        {/* MODE 1: Auto — "Nosotros lo hacemos" */}
        <div style={{
          background: '#111827', padding: '28px 24px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent)', marginBottom: 16,
          }}>
            <Sparkles size={16} style={{ color: '#ffffff' }} />
          </div>
          <p style={{
            fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: '#ffffff', lineHeight: 1.1, marginBottom: 8,
          }}>
            {t('modes.auto.title')}
          </p>
          <p style={{
            fontFamily: f, fontSize: 12, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.5, marginBottom: 16, flex: 1,
          }}>
            {t('modes.auto.description')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
            }}>
              {limits.autoProposalsPerWeek} posts/sem
              {limits.videosPerWeek > 0 ? ` + ${limits.videosPerWeek} vid` : ''}
            </span>
            <Link href="#proposals" style={{
              fontFamily: fc, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--accent)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Ver propuestas <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* MODE 2: Pedidos — "Pídenos lo que necesites" */}
        <Link href="/posts/new?mode=request" style={{
          background: 'var(--bg)', padding: '28px 24px',
          display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          transition: 'background 0.15s',
        }}>
          <div style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--accent)', marginBottom: 16,
          }}>
            <Send size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{
            fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 8,
          }}>
            {t('modes.request.title')}
          </p>
          <p style={{
            fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)',
            lineHeight: 1.5, marginBottom: 16, flex: 1,
          }}>
            {t('modes.request.description')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}>
              {limits.requestsPerMonth === Infinity ? 'Ilimitado' : `${limits.requestsPerMonth} pedidos/mes`}
            </span>
            <span style={{
              fontFamily: fc, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Solicitar <ArrowRight size={12} />
            </span>
          </div>
        </Link>

        {/* MODE 3: Self-service — "Crea tú mismo" */}
        <Link href="/posts/new?mode=self-service" style={{
          background: 'var(--bg)', padding: '28px 24px',
          display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          transition: 'background 0.15s',
        }}>
          <div style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--text-tertiary)', marginBottom: 16,
          }}>
            <Paintbrush size={14} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <p style={{
            fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 8,
          }}>
            {t('modes.selfService.title')}
          </p>
          <p style={{
            fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)',
            lineHeight: 1.5, marginBottom: 16, flex: 1,
          }}>
            {t('modes.selfService.description')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}>
              {limits.selfServiceActions === Infinity ? 'Ilimitado' : `${limits.selfServiceActions} acciones/mes`}
            </span>
            <span style={{
              fontFamily: fc, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Crear <ArrowRight size={12} />
            </span>
          </div>
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           WEEKLY PROPOSALS (auto mode)
         ══════════════════════════════════════════════════════════════════════ */}
      <div id="proposals">
        <WeeklyProposals proposals={proposalPosts} />
      </div>

      </div>

      {/* ── Upcoming dates — horizontal scroll ── */}
      {upcomingDates.length > 0 && (
        <div className="dashboard-upcoming-section">
          <div className="dashboard-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{
                fontFamily: f, fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.14em',
                color: 'var(--accent)', margin: 0,
                paddingBottom: 8, borderBottom: '1px solid var(--accent-soft)',
              }}>
                {t('sections.upcomingDates')}
              </h2>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: 'var(--border)',
              border: '1px solid var(--border)', marginBottom: 48,
            }}>
              {upcomingDates.map((d: { id: string; name: string; daysUntil: number; idea?: string }) => (
                <div key={d.id} style={{
                  background: 'var(--bg)', padding: '16px 20px',
                  minHeight: 122,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {d.name}
                  </p>
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    en {d.daysUntil} días
                  </p>
                  {d.idea && (
                    <p style={{ fontFamily: f, fontSize: 11, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
                      {d.idea}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-inner">

      {/* ── Quick actions — 3x2 grid ── */}
      <h2 style={{
        fontFamily: f, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.14em',
        color: 'var(--accent)', marginBottom: 16,
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
            <Icon size={18} style={{ color: 'var(--accent)' }} />
            <span>{label}</span>
            <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />
          </Link>
        ))}
      </div>

      </div>

      <div className="dashboard-inspiration-section">
        <div className="dashboard-inner">
          <InspirationTeaser />
        </div>
      </div>

      <div className="dashboard-inner">

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
              color: 'var(--bg)', background: 'var(--accent)',
            padding: '10px 24px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'opacity 0.15s', whiteSpace: 'nowrap',
          }}>
            {t('sections.pendingAction')} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Recent posts ── */}
      {recentPublishedPosts.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <h2 style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--accent)', margin: 0,
            }}>
              {t('sections.recentPosts')}
            </h2>
            <Link href="/posts" style={{
              fontSize: 11, color: 'var(--accent)', textDecoration: 'none',
              fontFamily: f, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Ver todo →
            </Link>
          </div>
          <div style={{ border: '1px solid var(--border)', marginBottom: 48 }}>
            {recentPublishedPosts.map((post, i) => (
              <Link key={post.id} href={`/posts/${post.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 20px', textDecoration: 'none', color: 'inherit',
                borderBottom: i < recentPublishedPosts.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.15s',
              }}>
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    <Sparkles size={16} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.caption ? `${post.caption.slice(0, 80)}...` : '—'}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    {post.quality_score != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 500, fontFamily: f,
                        color: post.quality_score >= 8 ? 'var(--success)' : post.quality_score >= 6 ? 'var(--warning)' : 'var(--error)',
                      }}>
                        {post.quality_score}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(post.published_at ?? post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
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
    </div>
  );
}
