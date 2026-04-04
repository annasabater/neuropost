// =============================================================================
// NEUROPOST — CompetitorAgent
// Analyzes public Instagram competitor profiles and generates content ideas.
// Only accesses publicly visible information per Meta ToS.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorPost {
  caption:        string | null;
  media_type:     string;
  like_count:     number;
  comments_count: number;
  timestamp:      string;
}

export interface CompetitorProfile {
  username:        string;
  followers_count: number;
  media_count:     number;
  biography:       string | null;
}

export interface ContentIdea {
  title:           string;
  format:          string;
  caption:         string;
  hashtags:        string[];
  inspiration:     string;
  originalTwist:   string;
}

export interface CompetitorAnalysisResult {
  competitorAnalysis: {
    topFormats:        string[];
    topTopics:         string[];
    avgEngagement:     number;
    postingFrequency:  string;
    tone:              string;
    strengths:         string[];
    weaknesses:        string[];
  };
  contentIdeas:      ContentIdea[];
  opportunityGaps:   string;
}

// ─── Fetch public IG data ────────────────────────────────────────────────────

export async function fetchCompetitorPublicData(
  username: string,
  accessToken: string,
): Promise<{ profile: CompetitorProfile | null; posts: CompetitorPost[] }> {
  // Resolve IG user ID from username via search
  const searchRes = await fetch(
    `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=0&q=${encodeURIComponent(username)}&access_token=${accessToken}`,
  ).then(r => r.json()).catch(() => null) as { id?: string } | null;

  if (!searchRes?.id) return { profile: null, posts: [] };

  const [profileRes, mediaRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${searchRes.id}?fields=username,followers_count,media_count,biography&access_token=${accessToken}`).then(r => r.json()).catch(() => null),
    fetch(`https://graph.facebook.com/v19.0/${searchRes.id}/media?fields=caption,media_type,like_count,comments_count,timestamp&limit=12&access_token=${accessToken}`).then(r => r.json()).catch(() => null),
  ]) as [CompetitorProfile | null, { data?: CompetitorPost[] } | null];

  return {
    profile: profileRes,
    posts:   (mediaRes as { data?: CompetitorPost[] })?.data ?? [],
  };
}

// ─── Analyze with Claude ─────────────────────────────────────────────────────

export async function analyzeCompetitor(input: {
  competitorUsername: string;
  competitorBio:      string | null;
  followersCount:     number;
  recentPosts:        CompetitorPost[];
  clientSector:       string;
  clientBrandVoice:   string;
  clientName:         string;
}): Promise<CompetitorAnalysisResult> {
  const postsText = input.recentPosts.slice(0, 12).map((p, i) =>
    `Post ${i + 1}: [${p.media_type}] Likes: ${p.like_count} | Comentarios: ${p.comments_count} | Caption: ${(p.caption ?? '').substring(0, 120)}`,
  ).join('\n');

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 2500,
    system: `Analiza la estrategia de contenido de este competidor en Instagram.
Tu objetivo es identificar qué está funcionando para INSPIRAR al cliente, NO para copiar.
Genera ideas 100% originales basadas en lo que funciona.

Devuelve SOLO JSON válido:
{
  "competitorAnalysis": {
    "topFormats": ["formato1", "formato2"],
    "topTopics": ["tema1", "tema2"],
    "avgEngagement": 234,
    "postingFrequency": "3-4 veces por semana",
    "tone": "descripción del tono",
    "strengths": ["fortaleza1", "fortaleza2"],
    "weaknesses": ["debilidad1", "debilidad2"]
  },
  "contentIdeas": [
    {
      "title": "título de la idea",
      "format": "reel",
      "caption": "texto listo para publicar adaptado al cliente",
      "hashtags": ["#uno", "#dos"],
      "inspiration": "basado en qué del competidor",
      "originalTwist": "cómo lo hacemos diferente y mejor"
    }
  ],
  "opportunityGaps": "qué no está haciendo el competidor que nosotros podemos hacer"
}`,
    messages: [{
      role: 'user',
      content: `Competidor: @${input.competitorUsername}
Bio: ${input.competitorBio ?? 'Sin bio'}
Seguidores: ${input.followersCount.toLocaleString()}

Últimos posts:
${postsText}

Nuestro cliente: ${input.clientName} (sector: ${input.clientSector})
Voz de marca del cliente: ${input.clientBrandVoice}

Genera el análisis completo y 5 ideas de contenido originales para nuestro cliente.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in competitor analysis response');
  return JSON.parse(jsonMatch[0]) as CompetitorAnalysisResult;
}
