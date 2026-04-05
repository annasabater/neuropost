import { NextResponse } from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { analyzeReference } from '@/agents/InspirationAgent';

// POST /api/inspiracion/analizar
// Calls InspirationAgent to analyze a reference image and return style + recreation instructions.
export async function POST(request: Request) {
  try {
    await requireServerUser();

    const body = await request.json() as {
      referenceImageUrl: string;
      clientNotes:       string;
      brandContext:      string;
      sector:            string;
      visualStyle?:      string;
    };

    if (!body.referenceImageUrl?.trim()) {
      return NextResponse.json({ error: 'referenceImageUrl is required' }, { status: 400 });
    }

    const result = await analyzeReference({
      referenceImageUrl: body.referenceImageUrl,
      clientNotes:       body.clientNotes  ?? '',
      brandContext:      body.brandContext ?? '',
      sector:            body.sector       ?? '',
      visualStyle:       body.visualStyle,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
