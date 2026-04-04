import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireSuperAdmin();
    const db      = createAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // This week counts
    const [thisWeek, lastWeek] = await Promise.all([
      db.from('prospects').select('id,status,channel,updated_at').gte('created_at', weekAgo),
      db.from('prospects').select('id,status,channel').gte('created_at', twoWeeksAgo).lt('created_at', weekAgo),
    ]);

    const tw = thisWeek.data ?? [];
    const lw = lastWeek.data ?? [];

    const count = (arr: typeof tw, filter: (p: (typeof tw)[0]) => boolean) => arr.filter(filter).length;

    const metrics = {
      contacted:  { now: tw.length,  prev: lw.length },
      replied:    {
        now:  count(tw, (p) => ['replied','interested','converted'].includes(p.status)),
        prev: count(lw, (p) => ['replied','interested','converted'].includes(p.status)),
      },
      interested: {
        now:  count(tw, (p) => ['interested','converted'].includes(p.status)),
        prev: count(lw, (p) => ['interested','converted'].includes(p.status)),
      },
      converted:  {
        now:  count(tw, (p) => p.status === 'converted'),
        prev: count(lw, (p) => p.status === 'converted'),
      },
    };

    // Channel breakdown
    const channels = tw.reduce((acc: Record<string, number>, p: (typeof tw)[0]) => {
      acc[p.channel] = (acc[p.channel] ?? 0) + 1;
      return acc;
    }, {});

    // Pending actions
    const [pendingReplies, unreadMessages, interestedNoFollowup] = await Promise.all([
      db.from('outbound_comments').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
      db.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
      db.from('prospects').select('id', { count: 'exact', head: true })
        .eq('status', 'interested')
        .lt('last_activity', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Recent activity feed (last 20 interactions)
    const { data: activity } = await db
      .from('prospect_interactions')
      .select('id,type,content,created_at,prospect_id,prospects(username)')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      metrics,
      channels,
      pendingActions: {
        commentReplies:        pendingReplies.count ?? 0,
        unreadMessages:        unreadMessages.count ?? 0,
        interestedNoFollowup:  interestedNoFollowup.count ?? 0,
      },
      activity: activity ?? [],
    });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
