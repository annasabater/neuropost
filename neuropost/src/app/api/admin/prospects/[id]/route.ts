import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const db     = createAdminClient();

    const [{ data: prospect }, { data: interactions }, { data: comments }, { data: messages }] =
      await Promise.all([
        db.from('prospects').select('*').eq('id', id).single(),
        db.from('prospect_interactions')
          .select('*')
          .eq('prospect_id', id)
          .order('created_at', { ascending: false }),
        db.from('outbound_comments')
          .select('*')
          .eq('prospect_id', id)
          .order('sent_at', { ascending: false }),
        db.from('messages')
          .select('*')
          .eq('prospect_id', id)
          .order('created_at', { ascending: false }),
      ]);

    if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ prospect, interactions: interactions ?? [], comments: comments ?? [], messages: messages ?? [] });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user   = await requireSuperAdmin();
    const { id } = await params;
    const db     = createAdminClient();
    const body   = await request.json() as Record<string, unknown>;

    const { status: prevStatus } = (await db.from('prospects').select('status').eq('id', id).single()).data ?? {};

    const { data, error } = await db
      .from('prospects')
      .update({ ...body, updated_at: new Date().toISOString(), last_activity: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    if (body.status && body.status !== prevStatus) {
      await db.from('prospect_interactions').insert({
        prospect_id: id,
        type:        'status_changed',
        content:     `Estado: ${prevStatus} → ${body.status}`,
        metadata:    { changed_by: user.id },
      });
    }
    if (body.notes) {
      await db.from('prospect_interactions').insert({
        prospect_id: id,
        type:        'note_added',
        content:     String(body.notes),
      });
    }

    return NextResponse.json({ prospect: data });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
