import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ thread: string }> },
) {
  try {
    await requireSuperAdmin();
    const { thread } = await params;
    const db = createAdminClient();

    const { data: messages, error } = await db
      .from('messages')
      .select('*')
      .or(`thread_id.eq.${thread},id.eq.${thread}`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (messages?.length) {
      // Mark thread messages as read
      await db.from('messages')
        .update({ status: 'read' })
        .or(`thread_id.eq.${thread},id.eq.${thread}`)
        .eq('status', 'unread');
    }

    return NextResponse.json({ messages: messages ?? [] });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
