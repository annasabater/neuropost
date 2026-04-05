import { NextResponse } from 'next/server';
import { getWorker } from '@/lib/worker';

export async function GET() {
  try {
    const worker = await getWorker();
    if (!worker) return NextResponse.json({ error: 'Not a worker' }, { status: 403 });
    return NextResponse.json({ worker });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
