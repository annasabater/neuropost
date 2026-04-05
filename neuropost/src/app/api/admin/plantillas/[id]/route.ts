import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const worker = await requireWorker();
    if (worker.role !== 'admin' && worker.role !== 'senior') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json() as {
      title?:           string;
      description?:     string | null;
      thumbnail_url?:   string | null;
      sectors?:         string[];
      styles?:          string[];
      format?:          string | null;
      prompt_template?: string | null;
      tags?:            string[];
      is_active?:       boolean;
    };

    const updates: Record<string, unknown> = {};
    if (body.title           !== undefined) updates.title           = body.title;
    if (body.description     !== undefined) updates.description     = body.description;
    if (body.thumbnail_url   !== undefined) updates.thumbnail_url   = body.thumbnail_url;
    if (body.sectors         !== undefined) updates.sectors         = body.sectors;
    if (body.styles          !== undefined) updates.styles          = body.styles;
    if (body.format          !== undefined) updates.format          = body.format;
    if (body.prompt_template !== undefined) updates.prompt_template = body.prompt_template;
    if (body.tags            !== undefined) updates.tags            = body.tags;
    if (body.is_active       !== undefined) updates.is_active       = body.is_active;

    const db = createAdminClient();
    const { data: template, error } = await db
      .from('inspiration_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ template });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
