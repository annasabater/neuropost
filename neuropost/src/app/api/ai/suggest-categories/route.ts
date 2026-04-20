import { NextResponse } from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    await requireServerUser();

    const body = await request.json() as {
      sector:              string;
      current_categories:  string[];   // already-active category names
      input:               string;     // what the user is typing
    };

    const { sector, current_categories, input } = body;
    if (!input?.trim()) return NextResponse.json({ suggestions: [] });

    const existing = current_categories?.join(', ') || 'ninguna';

    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `El usuario tiene un negocio de tipo "${sector}".
Ya tiene estas categorías de contenido: [${existing}].
Está escribiendo: "${input}".

Sugiere 3-5 categorías de contenido para Instagram que sean relevantes para este tipo de negocio y estén relacionadas con lo que está escribiendo. No repitas las que ya tiene. Responde SOLO con un JSON array de strings, sin explicación.`,
      }],
    });

    const text = msg.content.find((c) => c.type === 'text');
    if (!text || text.type !== 'text') return NextResponse.json({ suggestions: [] });

    const cleaned = text.text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const suggestions = JSON.parse(cleaned) as string[];
    return NextResponse.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 5) : [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ suggestions: [] }); // graceful — autocomplete failure is non-critical
  }
}
