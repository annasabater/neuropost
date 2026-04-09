'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
    <div className="blog-reading-shell">
      <div className="container blog-reading-container">
        <Link href="/blog" className="blog-reading-back">← Blog</Link>

        <header className="blog-reading-hero">
          <div className="blog-reading-meta-row">
            <span className="blog-reading-time-pill">{readTime} min</span>
            <span className="blog-reading-meta-text">{readTime} min de lectura · {dateLabel}</span>
          </div>
          <h1 className="blog-reading-title">{title}</h1>
          <p className="blog-reading-excerpt">{excerpt}</p>

          <div className="blog-quick-summary">
            <p className="blog-quick-summary-label">📌 En 30 segundos</p>
            <ul className="blog-quick-summary-list">
              {summaryPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        </header>

        <div className="blog-reading-layout">
          <article id="article-reading-root" className="blog-reading-article">
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

              return (
                <div key={section.id}>
                  <section id={section.id} className="article-section-block">
                    <div className="article-section-index">{String(index + 1).padStart(2, '0')}</div>
                    <h2 className="article-section-title">{section.title}</h2>

                    <div className="article-highlight-box">
                      <p className="article-highlight-label">💡 CLAVE</p>
                      <p className="article-highlight-text">{section.keyIdea}</p>
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

                    <ul className="article-insights-list">
                      {visibleInsights.map((item, itemIdx) => (
                        <li key={itemIdx}>✔ {item}</li>
                      ))}
                    </ul>

                    <p className="article-micro-callout">→ {section.microCallout}</p>
                  </section>

                  {index === 1 && (
                    <div className="article-mid-cta">
                      <p className="article-mid-cta-title">🚀 ¿Quieres que lo hagamos por ti?</p>
                      <p className="article-mid-cta-text">Nos encargamos de todo tu contenido.</p>
                      <Link href="/register" className="article-mid-cta-button">Probar gratis</Link>
                    </div>
                  )}

                  {index % 2 === 1 && index < sections.length - 1 && (
                    <blockquote className="article-quote-break">
                      “{section.microCallout}”
                    </blockquote>
                  )}
                </div>
              );
            })}
          </article>

          <aside className="blog-reading-sidebar">
            <div className="blog-progress-card">
              <p className="blog-progress-title">Progreso de lectura</p>
              <progress className="blog-progress-track" max={100} value={progressPct} />
              <div className="blog-progress-meta">
                <span>{progressPct}% leído</span>
                <span>{remainingMins} min restantes</span>
              </div>
            </div>

            <div className="blog-toc-card">
              <p className="blog-toc-title">En este artículo</p>
              <ul className="blog-toc-list">
                {sections.map((section, idx) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={activeSection === section.id ? 'blog-toc-link is-active' : 'blog-toc-link'}
                    >
                      <span>{String(idx + 1).padStart(2, '0')}</span>
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
