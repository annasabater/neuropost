import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    await requireWorker();
    const db = createAdminClient();
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') ?? '10';

    const { data, error } = await db
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    return NextResponse.json({ announcements: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();
    const body = await request.json();
    const { title, description, image_url, target_audience } = body;

    if (!title?.trim()) throw new Error('Title required');
    if (!description?.trim()) throw new Error('Description required');

    const { data, error } = await db
      .from('announcements')
      .insert({
        title: title.trim(),
        description: description.trim(),
        image_url,
        target_audience: target_audience ?? 'all',
        created_by_worker_id: worker.id,
        is_published: false,
        published_at: null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ announcement: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWorker();
    const db = createAdminClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    if (!id) throw new Error('ID required');

    if (action === 'publish') {
      const { data, error } = await db
        .from('announcements')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ announcement: data });
    }

    const body = await request.json();
    const { data, error } = await db
      .from('announcements')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ announcement: data });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireWorker();
    const db = createAdminClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) throw new Error('ID required');

    const { error } = await db.from('announcements').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
