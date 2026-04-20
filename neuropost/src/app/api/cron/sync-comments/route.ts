import { NextResponse } from 'next/server';

// Delegates to the Meta sync-comments endpoint
export async function GET(request: Request) {
  const auth      = request.headers.get('authorization');
  const isVercel  = request.headers.get('x-vercel-cron') === '1';
  const secret    = process.env.CRON_SECRET ?? '';
  const validBearer = secret && auth === `Bearer ${secret}`;
  if (!isVercel && !validBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res    = await fetch(`${appUrl}/api/meta/sync-comments`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const json = await res.json();
  return NextResponse.json(json);
}
