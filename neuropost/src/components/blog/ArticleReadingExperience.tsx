'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

function useIsMobile(breakpoint = 760) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
  keyIdea: string;
  insights: string[];
  microCallout: string;
};

type Props = {
  title: string;
  excerpt: string;
  readTime: number;
  dateLabel: string;
  summaryPoints: string[];
  sections: Section[];
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[\s\W_]+/g, ' ').trim();
}

function renderTextWithHighlights(text: string): ReactNode[] {
  const parts = text.split(/(#[A-Za-z0-9_\u00C0-\u017F]+|\b\d+(?:[.,]\d+)?%\b|\b\d+(?:[.,]\d+)?\s*(?:a|-)\s*\d+(?:[.,]\d+)?\b|\b\d+(?:[.,]\d+)?\s*(?:mill[oó]n(?:es)?|mil)\b)/gi);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('#')) {
      return <span key={index} className="article-hashtag">{part}</span>;
    }
    if (/\d/.test(part) && /%|\b(?:a|-)\b|mill[oó]n|mil/i.test(part)) {
      return <span key={index} className="article-metric">{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

function formatKeyPoint(text: string): ReactNode {
  const splitPhrase = text.match(/^(.*?consiguen, de media,)(.*)$/i);

  if (!splitPhrase) {
    return renderTextWithHighlights(text);
  }

  return (
    <span>
      {renderTextWithHighlights(splitPhrase[1])}
      <br />
      <span className="article-key-point-strong">{renderTextWithHighlights(splitPhrase[2])}</span>
    </span>
  );
}

function extractActionPoints(paragraphs: string[], keyIdea: string): string[] {
  const keyIdeaNormalized = normalizeText(keyIdea);
  const sentences = paragraphs
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 32 && s.length <= 180)
    .filter((s) => normalizeText(s) !== keyIdeaNormalized);

  return Array.from(new Set(sentences)).slice(0, 5);
}

function parseNumberedPoint(text: string): { number: string; body: string } | null {
  const match = text.match(/^(\d+)\.\s*(.+)$/);
  if (!match) return null;
  return { number: match[1], body: match[2] };
}

function chunkParagraph(paragraph: string): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return [paragraph];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > 170 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function ArticleReadingExperience({
  title,
  excerpt,
  readTime,
  dateLabel,
  summaryPoints,
  sections,
}: Props) {
  const isMobile = useIsMobile();
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '');

  const progressPct = useMemo(() => Math.round(progress * 100), [progress]);
  const remainingMins = useMemo(
    () => Math.max(1, Math.ceil(readTime * (1 - progress))),
    [readTime, progress],
  );

  useEffect(() => {
    const onScroll = () => {
      const root = document.getElementById('article-reading-root');
      if (!root) return;

      const start = root.offsetTop - 120;
      const total = Math.max(1, root.offsetHeight - window.innerHeight);
      const current = Math.min(Math.max(window.scrollY - start, 0), total);
      setProgress(current / total);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const sectionNodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sectionNodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0.2, 0.4, 0.7] },
    );

    sectionNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="blog-reading-shell" style={{ paddingTop: 132, paddingBottom: 72, background: '#ffffff', minHeight: '100vh' }}>
      <div className="container blog-reading-container" style={{ maxWidth: 1150 }}>
        <Link href="/blog" className="blog-reading-back">← Blog</Link>

        <header className="blog-reading-hero" style={{ marginBottom: 42 }}>
          <div className="blog-reading-meta-row">
            <span className="blog-reading-time-pill">{readTime} min</span>
            <span className="blog-reading-meta-text">{readTime} min de lectura · {dateLabel}</span>
          </div>
          <h1 className="blog-reading-title">{title}</h1>
          <p className="blog-reading-excerpt">{excerpt}</p>

          <div className="blog-quick-summary" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f5f5f5 100%)', padding: '20px 22px', width: '100%' }}>
            <p className="blog-quick-summary-label">📌 En 30 segundos</p>
            <ul className="blog-quick-summary-list">
              {summaryPoints.map((point, idx) => (
                <li key={idx}>{renderTextWithHighlights(point)}</li>
              ))}
            </ul>
          </div>
        </header>

        <div className="blog-reading-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 290px', gap: 42, alignItems: 'start' }}>
          <article id="article-reading-root" className="blog-reading-article" style={{ display: 'grid', gap: 44, maxWidth: 780, margin: '0 auto' }}>
            {sections.map((section, index) => {
              const keyIdeaNormalized = normalizeText(section.keyIdea);
              const visibleParagraphs = section.paragraphs.filter((paragraph, paragraphIndex) => {
                if (paragraphIndex !== 0) return true;
                return normalizeText(paragraph) !== keyIdeaNormalized;
              });

              const chunkedParagraphs = visibleParagraphs.flatMap((paragraph) => chunkParagraph(paragraph));

              const visibleInsights = section.insights.filter((insight) => {
                return normalizeText(insight) !== keyIdeaNormalized;
              });

              const actionPoints = extractActionPoints(visibleParagraphs, section.keyIdea);
              const mergedPoints = Array.from(new Set([...visibleInsights, ...actionPoints])).slice(0, 5);
              const apartes = mergedPoints.slice(0, 2);
              const hashtags = Array.from(
                new Set((visibleParagraphs.join(' ').match(/#[A-Za-z0-9_\u00C0-\u017F]+/g) ?? []).map((h) => h.trim())),
              ).slice(0, 6);

              return (
                <div key={section.id}>
                  <section id={section.id} className="article-section-block" style={{ borderTop: '1px solid #eceff1', paddingTop: 34, background: '#ffffff', paddingBottom: 12 }}>
                    <div className="article-section-index">{String(index + 1).padStart(2, '0')}</div>
                    <h2 className="article-section-title">{section.title}</h2>

                    <div className="article-highlight-box" style={{ borderLeft: '3px solid #0F766E', background: '#f8fafc', padding: '12px 14px', marginBottom: 20 }}>
                      <p className="article-highlight-label">💡 CLAVE</p>
                      <p className="article-highlight-text">{renderTextWithHighlights(section.keyIdea)}</p>
                    </div>

                    <div className="article-paragraphs-wrap">
                      {chunkedParagraphs.map((paragraph, pIdx) => {
                        const numberedPoint = parseNumberedPoint(paragraph);

                        if (numberedPoint) {
                          return (
                            <div key={pIdx} className="article-numbered-point">
                              <span className="article-number-badge">{numberedPoint.number}</span>
                              <p className="article-number-content">{renderTextWithHighlights(numberedPoint.body)}</p>
                            </div>
                          );
                        }

                        return (
                          <p key={pIdx} className="article-body-paragraph">{renderTextWithHighlights(paragraph)}</p>
                        );
                      })}
                    </div>

                    <div style={{ background: '#f7f8fa', borderLeft: '3px solid #d1d5db', padding: '14px 16px', marginBottom: 16 }}>
                      <p style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, fontWeight: 900, marginBottom: 8 }}>Puntos clave</p>
                      <ul className="article-insights-list" style={{ marginBottom: 0 }}>
                        {mergedPoints.map((item, itemIdx) => (
                          <li key={itemIdx}><span className="article-point-marker">✔</span> {formatKeyPoint(item)}</li>
                        ))}
                      </ul>
                    </div>

                    {apartes.length > 0 && (
                      <div className="article-apartes-wrap" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
                        {apartes.map((aparte, aparteIdx) => (
                          <div key={aparteIdx} className="article-aparte-card" style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderLeft: '3px solid #d1d5db', padding: '10px 12px' }}>
                            <p className="article-aparte-label" style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, fontWeight: 900, marginBottom: 6 }}>Aparte</p>
                            <p className="article-aparte-text" style={{ color: '#374151', fontSize: 13, lineHeight: 1.55, fontWeight: 600 }}>{formatKeyPoint(aparte)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {hashtags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {hashtags.map((tag) => (
                          <span key={tag} style={{ fontSize: 12, fontWeight: 700, color: '#374151', background: '#eef2f7', padding: '4px 8px' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="article-micro-callout">→ {renderTextWithHighlights(section.microCallout)}</p>
                  </section>

                  {index === 1 && (
                    <div className="article-mid-cta" style={{ marginTop: 8, background: '#111111', color: '#ffffff', padding: '28px 24px', textAlign: 'center' }}>
                      <p className="article-mid-cta-title">🚀 ¿Quieres que lo hagamos por ti?</p>
                      <p className="article-mid-cta-text">Nos encargamos de todo tu contenido.</p>
                      <Link href="/register" className="article-mid-cta-button">Probar gratis</Link>
                    </div>
                  )}

                  {index % 2 === 1 && index < sections.length - 1 && (
                    <blockquote className="article-quote-break" style={{ marginTop: 8 }}>
                      “{section.microCallout}”
                    </blockquote>
                  )}
                </div>
              );
            })}
          </article>

          <aside className="blog-reading-sidebar" style={{ position: 'sticky', top: 88, display: 'grid', gap: 12 }}>
            <div className="blog-progress-card" style={{ border: '1px solid #e5e7eb', background: '#ffffff', padding: 16 }}>
              <p className="blog-progress-title">Progreso de lectura</p>
              <progress className="blog-progress-track" max={100} value={progressPct} />
              <div className="blog-progress-meta">
                <span>{progressPct}% leído: {remainingMins} min restantes</span>
              </div>
            </div>

            <div className="blog-toc-card" style={{ border: '1px solid #e5e7eb', background: '#ffffff', padding: 16 }}>
              <p className="blog-toc-title">En este artículo</p>
              <ul className="blog-toc-list">
                {sections.map((section, idx) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={activeSection === section.id ? 'blog-toc-link is-active' : 'blog-toc-link'}
                    >
                      <span className="blog-toc-number">{String(idx + 1).padStart(2, '0')}.</span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
