import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BarChart3, Calendar, Plus, ArrowRight,
  ChevronRight, Sparkles, Send, Paintbrush, Image,
  Flame, MessageSquare, Archive,
} from 'lucide-react';
import { getServerBrand, createServerClient } from '@/lib/supabase';
import { TrendsBanner } from '@/components/trends/TrendsBanner';
import DashboardTour from '@/components/onboarding/DashboardTour';
import IncidentBanner from '@/components/layout/IncidentBanner';
import ChangelogModal from '@/components/layout/ChangelogModal';
import { WeeklyProposals } from '@/components/dashboard/WeeklyProposals';
import { getUpcomingDatesForBrand } from '@/agents/SeasonalAgent';
import { PLAN_LIMITS, PLAN_META } from '@/types';
import type { SubscriptionPlan } from '@/types';
import InspirationTeaser from '@/components/inspiration/InspirationTeaser';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default async function DashboardPage() {
  const brand = await getServerBrand();
  if (!brand) redirect('/onboarding');

  const supabase = await createServerClient();
  const now = new Date();
  const t   = await getTranslations('dashboard');

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const [{ data: posts }, { data: publishedPosts }, { data: weeklyProposals }, { data: allDates }] = await Promise.all([
    supabase.from('posts')
      .select('id, caption, status, published_at, created_at, quality_score, image_url')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('posts')
      .select('id, caption, status, published_at, created_at, quality_score, image_url')
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(6),
    supabase.from('posts')
      .select('id, caption, status, created_at, quality_score, image_url, format, ai_explanation')
      .eq('brand_id', brand.id)
      .in('status', ['generated', 'pending', 'approved', 'scheduled'])
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('seasonal_dates').select('*'),
  ]);

  const allPosts             = posts ?? [];
  const recentPublishedPosts = publishedPosts ?? [];
  const proposalPosts        = weeklyProposals ?? [];

  const publishedThisMonth = allPosts.filter((p) => {
    if (!p.published_at) return false;
    const d = new Date(p.published_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const scheduled = allPosts.filter((p) => p.status === 'scheduled').length;
  const pending   = allPosts.filter((p) => p.status === 'pending').length;

  const limits      = PLAN_LIMITS[brand.plan];
  const planLimit   = limits.postsPerMonth;
  const isUnlimited = planLimit === Infinity;

  const dbDates = getUpcomingDatesForBrand(allDates ?? [], brand.sector ?? 'otro', 30).slice(0, 5);

  const STATIC_DATES = [
    { name: 'Sant Jordi',          date: '2026-04-23', idea: 'Contingut emocional amb roses i llibres.' },
    { name: 'Dia de la Mare',      date: '2026-05-03', idea: 'Promociona regals i experiències.' },
    { name: 'Rebaixes d\'estiu',   date: '2026-07-01', idea: 'Ofertes flash, countdown, productes.' },
    { name: 'La Mercè',            date: '2026-09-24', idea: 'Contingut vinculat a la festa major.' },
    { name: 'Black Friday',        date: '2026-11-27', idea: 'Ofertes exclusives amb anticipació.' },
    { name: 'Nadal',               date: '2026-12-15', idea: 'Campanya nadalenca. Regals, packs.' },
  ];
  const todayStr     = now.toISOString().slice(0, 10);
  const staticUpcoming = STATIC_DATES
    .filter((d) => d.date > todayStr)
    .map((d) => ({
      id: d.date,
      name: d.name,
      daysUntil: Math.ceil((new Date(d.date).getTime() - now.getTime()) / 86400000),
      idea: d.idea,
    }))
    .slice(0, 4);

  const allUpcoming  = [...dbDates.map((d) => ({ ...d, idea: undefined as string | undefined })), ...staticUpcoming];
  const seen         = new Set<string>();
  const upcomingDates = allUpcoming
    .filter((d) => { if (seen.has(d.name)) return false; seen.add(d.name); return true; })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any).from('brands').update({ last_login_at: now.toISOString() }).eq('id', brand.id);

  const postsWeek  = brand.posts_this_week  ?? 0;
  const postsLimit = limits.postsPerWeek;
  const postsPct   = postsLimit === Infinity ? 0 : Math.min(100, Math.round((postsWeek / postsLimit) * 100));

  return (
    <div className="page-content dashboard-page" style={{ background: 'var(--bg)' }}>
      <DashboardTour />

      {/* ── OVERVIEW HEADER ── */}
      <div style={{
        padding: '32px 28px 0',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <IncidentBanner />
        <TrendsBanner />

        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontFamily: f, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--accent)', marginBottom: 4,
          }}>
            Overview
          </p>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95,
          }}>
            {t('greeting', { name: brand.name })}
          </h1>
        </div>

        {/* ── STATS ROW — Instagram profile stats style ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          marginBottom: 0,
        }} className="ig-stats-row">
          {[
            { label: 'Publicados', value: String(publishedThisMonth), sub: 'este mes' },
            { label: 'Programados', value: String(scheduled), sub: 'pendientes' },
            { label: 'Por revisar', value: String(pending), sub: pending > 0 ? 'requieren acción' : 'al día' },
            { label: PLAN_META[brand.plan as SubscriptionPlan]?.label ?? brand.plan, value: isUnlimited ? '∞' : `${postsWeek}/${postsLimit}`, sub: 'posts esta semana' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{
              background: 'var(--bg)',
              padding: '16px 20px',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: fc, fontWeight: 900,
                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                color: 'var(--text-primary)',
                lineHeight: 1, marginBottom: 4,
              }}>
                {value}
              </p>
              <p style={{
                fontFamily: f, fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: 'var(--text-tertiary)',
              }}>
                {label}
              </p>
              <p style={{
                fontFamily: f, fontSize: 9,
                color: 'var(--text-tertiary)', marginTop: 2,
              }}>
                {sub}
              </p>
            </div>
          ))}
        </div>

        {/* Progress bar for posts/week */}
        {!isUnlimited && (
          <div style={{ height: 3, background: 'var(--bg-2)', marginTop: 0 }}>
            <div style={{
              height: '100%',
              width: `${postsPct}%`,
              background: postsPct >= 100 ? 'var(--error)' : postsPct >= 80 ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 0.4s ease',
            }} />
          </div>
        )}
      </div>

      {/* ── QUICK NAV — shortcuts row ── */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        background: 'var(--bg-1)',
      }}>
        {[
          { href: '/posts/new',   icon: Plus,         label: 'Nuevo post' },
          { href: '/inspiracion', icon: Flame,         label: 'Inspiración' },
          { href: '/calendar',    icon: Calendar,      label: 'Calendario' },
          { href: '/inbox',       icon: MessageSquare, label: 'Inbox' },
          { href: '/historial',   icon: Archive,       label: 'Historial' },
          { href: '/analytics',   icon: BarChart3,     label: 'Analytics' },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '10px 16px',
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            fontFamily: f,
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderRight: '1px solid var(--border)',
            whiteSpace: 'nowrap',
            transition: 'background 0.12s, color 0.12s',
            flexShrink: 0,
          }} className="ig-quicknav-item">
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>

      {/* ── CONTENT AREA ── */}
      <div style={{ padding: '28px 28px 0' }}>

        {/* ── 3 MODES — Content hub ── */}
        <p style={{
          fontFamily: f, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.14em',
          color: 'var(--accent)', marginBottom: 12,
          paddingBottom: 8, borderBottom: '1px solid var(--border)',
        }}>
          {t('sections.contentHub')}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          marginBottom: 36,
        }} className="ig-modes-grid">
          {/* MODE 1: Auto */}
          <div style={{
            background: '#111827',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 200,
          }}>
            <div style={{
              width: 28, height: 28,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Sparkles size={14} style={{ color: '#fff' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              textTransform: 'uppercase', color: '#fff', lineHeight: 1.1, marginBottom: 6,
            }}>
              {t('modes.auto.title')}
            </p>
            <p style={{
              fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.55, flex: 1, marginBottom: 12,
            }}>
              {t('modes.auto.description')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: f, fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.35)',
              }}>
                {limits.autoProposalsPerWeek} posts/sem
                {limits.videosPerWeek > 0 ? ` + ${limits.videosPerWeek} vid` : ''}
              </span>
              <Link href="#proposals" style={{
                fontFamily: fc, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--accent)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                Ver <ChevronRight size={11} />
              </Link>
            </div>
          </div>

          {/* MODE 2: Pedidos */}
          <Link href="/posts/new?mode=request" style={{
            background: 'var(--bg)',
            padding: '24px 20px',
            display: 'flex', flexDirection: 'column',
            textDecoration: 'none', color: 'inherit',
            minHeight: 200,
            transition: 'background 0.15s',
          }} className="ig-mode-card">
            <div style={{
              width: 28, height: 28,
              border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Send size={12} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6,
            }}>
              {t('modes.request.title')}
            </p>
            <p style={{
              fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)',
              lineHeight: 1.55, flex: 1, marginBottom: 12,
            }}>
              {t('modes.request.description')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: f, fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}>
                {limits.requestsPerMonth === Infinity ? 'Ilimitado' : `${limits.requestsPerMonth} pedidos/mes`}
              </span>
              <span style={{
                fontFamily: fc, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                Solicitar <ArrowRight size={11} />
              </span>
            </div>
          </Link>

          {/* MODE 3: Self-service */}
          <Link href="/posts/new?mode=self-service" style={{
            background: 'var(--bg)',
            padding: '24px 20px',
            display: 'flex', flexDirection: 'column',
            textDecoration: 'none', color: 'inherit',
            minHeight: 200,
            transition: 'background 0.15s',
          }} className="ig-mode-card">
            <div style={{
              width: 28, height: 28,
              border: '2px solid var(--border-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Paintbrush size={12} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6,
            }}>
              {t('modes.selfService.title')}
            </p>
            <p style={{
              fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)',
              lineHeight: 1.55, flex: 1, marginBottom: 12,
            }}>
              {t('modes.selfService.description')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontFamily: f, fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}>
                {limits.selfServiceActions === Infinity ? 'Ilimitado' : `${limits.selfServiceActions} acciones/mes`}
              </span>
              <span style={{
                fontFamily: fc, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                Crear <ArrowRight size={11} />
              </span>
            </div>
          </Link>
        </div>

        {/* ── WEEKLY PROPOSALS ── */}
        <div id="proposals" style={{ marginBottom: 36 }}>
          <WeeklyProposals proposals={proposalPosts} />
        </div>

      </div>

      {/* ── UPCOMING DATES — dark band ── */}
      {upcomingDates.length > 0 && (
        <div style={{
          background: '#111827',
          padding: '24px 28px',
          marginBottom: 0,
        }}>
          <p style={{
            fontFamily: f, fontSize: 9, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--accent)', marginBottom: 16,
          }}>
            {t('sections.upcomingDates')}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.08)',
          }} className="ig-dates-grid">
            {upcomingDates.map((d: { id: string; name: string; daysUntil: number; idea?: string }) => (
              <div key={d.id} style={{
                background: '#111827',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <p style={{
                    fontFamily: fc, fontWeight: 700, fontSize: 14,
                    color: '#fff', textTransform: 'uppercase', letterSpacing: '0.02em',
                  }}>
                    {d.name}
                  </p>
                  <span style={{
                    fontFamily: f, fontSize: 9, fontWeight: 600,
                    color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em',
                    background: 'rgba(15,118,110,0.15)',
                    padding: '2px 6px',
                    whiteSpace: 'nowrap',
                  }}>
                    {d.daysUntil}d
                  </span>
                </div>
                {d.idea && (
                  <p style={{
                    fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.5,
                  }}>
                    {d.idea}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INSPIRATION TEASER ── */}
      <div style={{ padding: '28px 28px 0' }}>
        <InspirationTeaser />
      </div>

      {/* ── PENDING ALERT ── */}
      {pending > 0 && (
        <div style={{
          margin: '28px 28px 0',
          padding: '16px 20px',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
          background: 'var(--accent-soft)',
        }}>
          <div>
            <p style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
              {pending} {t('metrics.pending')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: f }}>
              {t('sections.pendingSubtitle')}
            </p>
          </div>
          <Link href="/posts?filter=pending" style={{
            fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#fff', background: 'var(--accent)',
            padding: '10px 20px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap',
          }}>
            {t('sections.pendingAction')} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ── RECENT POSTS ── */}
      {recentPublishedPosts.length > 0 && (
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)',
          }}>
            <p style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--accent)',
            }}>
              {t('sections.recentPosts')}
            </p>
            <Link href="/posts" style={{
              fontSize: 11, color: 'var(--accent)', textDecoration: 'none',
              fontFamily: f, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Ver todo →
            </Link>
          </div>
          <div style={{ border: '1px solid var(--border)', marginBottom: 36 }}>
            {recentPublishedPosts.map((post, i) => (
              <Link key={post.id} href={`/posts/${post.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', textDecoration: 'none', color: 'inherit',
                borderBottom: i < recentPublishedPosts.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
                background: 'var(--bg)',
              }} className="ig-post-row">
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, background: 'var(--bg-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Image size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: f, fontSize: 12, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 3,
                  }}>
                    {post.caption ? `${post.caption.slice(0, 80)}…` : '—'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    {post.quality_score != null && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, fontFamily: f,
                        color: post.quality_score >= 8 ? 'var(--success)' : post.quality_score >= 6 ? 'var(--warning)' : 'var(--error)',
                      }}>
                        {post.quality_score}/10
                      </span>
                    )}
                  </div>
                </div>
                <span style={{
                  fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {new Date(post.published_at ?? post.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allPosts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px 60px', margin: '0 28px' }}>
          <div style={{
            width: 48, height: 48, background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <p style={{
            fontFamily: fc, fontWeight: 900, fontSize: 20,
            textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8,
          }}>
            {t('empty.noPosts')}
          </p>
          <p style={{
            fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28,
            fontFamily: f, lineHeight: 1.7,
          }}>
            {t('empty.noPostsSub')}
          </p>
          <Link href="/ideas" style={{
            fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: 'var(--text-primary)', color: 'var(--bg)',
            padding: '12px 28px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {t('empty.generateIdeas')} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div style={{ height: 48 }} />
      <ChangelogModal />

      <style>{`
        .ig-quicknav-item:hover { background: var(--bg-2) !important; color: var(--text-primary) !important; }
        .ig-mode-card:hover { background: var(--bg-1) !important; }
        .ig-post-row:hover { background: var(--bg-1) !important; }
        @media (max-width: 767px) {
          .ig-stats-row { grid-template-columns: repeat(2,1fr) !important; }
          .ig-modes-grid { grid-template-columns: 1fr !important; }
          .ig-dates-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .ig-dates-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
