import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { getWorker } from '@/lib/worker';

export async function GET() {
  try {
    const worker = await getWorker();
    if (!worker) return NextResponse.json({ error: 'Not a worker' }, { status: 403 });
    return NextResponse.json({ worker });
  } catch (err) {
    return apiError(err, 'worker/me');
  }
}
