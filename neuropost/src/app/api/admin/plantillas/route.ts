import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const worker = await requireWorker();
    if (worker.role !== 'admin' && worker.role !== 'senior') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const db = createAdminClient();
    const { data: templates, error } = await db
      .from('inspiration_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const worker = await requireWorker();
    if (worker.role !== 'admin' && worker.role !== 'senior') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const body = await request.json() as {
      title: string;
      description?: string | null;
      thumbnail_url?: string | null;
      sectors?: string[];
      styles?: string[];
      format?: string | null;
      prompt_template?: string | null;
      tags?: string[];
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
    }
    const db = createAdminClient();
    const { data: template, error } = await db
      .from('inspiration_templates')
      .insert({
        title:           body.title.trim(),
        description:     body.description     ?? null,
        thumbnail_url:   body.thumbnail_url   ?? null,
        sectors:         body.sectors         ?? [],
        styles:          body.styles          ?? [],
        format:          body.format          ?? null,
        prompt_template: body.prompt_template ?? null,
        tags:            body.tags            ?? [],
        is_active:       true,
        times_used:      0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ template });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
