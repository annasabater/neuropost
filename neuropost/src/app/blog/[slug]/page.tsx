import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { BLOG_POSTS } from '@/lib/blog-posts';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LandingNav } from '@/components/layout/LandingNav';
import { ArticleReadingExperience } from '@/components/blog/ArticleReadingExperience';

type ArticleSection = {
  id: string;
  title: string;
  paragraphs: string[];
  keyIdea: string;
  insights: string[];
  microCallout: string;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.trim();
}

function buildInsights(paragraphs: string[]): string[] {
  const sentences = paragraphs
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && s.length <= 180);

  return Array.from(new Set(sentences)).slice(0, 5);
}

function extractSections(content: string): ArticleSection[] {
  const headingRegex = /<h2>([\s\S]*?)<\/h2>/g;
  const headingMatches = Array.from(content.matchAll(headingRegex));
  const sections: ArticleSection[] = [];

  headingMatches.forEach((match, index) => {
    const titleRaw = stripHtml(match[1] ?? '');
    const start = (match.index ?? 0) + match[0].length;
    const end = headingMatches[index + 1]?.index ?? content.length;
    const sectionHtml = content.slice(start, end);
    const paragraphs = Array.from(sectionHtml.matchAll(/<p>([\s\S]*?)<\/p>/g))
      .map((pMatch) => stripHtml(pMatch[1] ?? ''))
      .filter(Boolean);

    if (!titleRaw || paragraphs.length === 0) return;

    const keyIdea = firstSentence(paragraphs[0]);
    const insights = buildInsights(paragraphs);
    const fallbackInsight = paragraphs.slice(0, 3);

    sections.push({
      id: `section-${index + 1}`,
      title: titleRaw,
      paragraphs,
      keyIdea,
      insights: insights.length > 0 ? insights : fallbackInsight,
      microCallout: insights[1] ?? keyIdea,
    });
  });

  return sections;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extractHeadings(html: string): string[] {
  const matches = html.match(/<h2>([^<]+)<\/h2>/g) ?? [];
  return matches.map((m) => m.replace(/<\/?h2>/g, ''));
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado — NeuroPost Blog' };
  return {
    title: `${post.title} — NeuroPost Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `https://neuropost.es/blog/${slug}`,
      siteName: 'NeuroPost',
      locale: 'es_ES',
      publishedTime: new Date(post.date).toISOString(),
      authors: ['NeuroPost'],
      images: [{ url: 'https://neuropost.es/og', width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: ['https://neuropost.es/og'],
    },
    alternates: { canonical: `https://neuropost.es/blog/${slug}` },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="blog-not-found-wrap">
        <div className="blog-not-found-content">
          <h1 className="blog-not-found-title">Artículo no encontrado</h1>
          <Link href="/blog" className="blog-not-found-link">← Volver al blog</Link>
        </div>
      </div>
    );
  }

  const sections = extractSections(post.content);
  const summaryPoints = sections.slice(0, 3).map((section) => section.keyIdea);

  return (
    <>
      <Script
        id={`article-schema-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          datePublished: new Date(post.date).toISOString(),
          dateModified: new Date(post.date).toISOString(),
          author: { '@type': 'Organization', name: 'NeuroPost', url: 'https://neuropost.es' },
          publisher: { '@type': 'Organization', name: 'NeuroPost', url: 'https://neuropost.es', logo: { '@type': 'ImageObject', url: 'https://neuropost.es/icon.svg' } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://neuropost.es/blog/${post.slug}` },
          url: `https://neuropost.es/blog/${post.slug}`,
        })}}
      />
      <LandingNav />
      <ArticleReadingExperience
        title={post.title}
        excerpt={post.excerpt}
        readTime={post.readTime}
        dateLabel={formatDate(post.date)}
        summaryPoints={summaryPoints}
        sections={sections}
      />
      <SiteFooter />
    </>
  );
}
