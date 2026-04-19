import { NextResponse }      from 'next/server';
import { headers }           from 'next/headers';
import { processReminders }  from '@/lib/agents/handlers/reminders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const authHeader  = headersList.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processReminders();

  return NextResponse.json({
    ok:          true,
    executed_at: new Date().toISOString(),
    ...result,
  });
}
