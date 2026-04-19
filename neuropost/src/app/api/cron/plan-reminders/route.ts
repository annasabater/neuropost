import { NextResponse } from 'next/server';
import { headers }      from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const authHeader  = headersList.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[cron/plan-reminders] Ejecutando — lógica pendiente en Sprint 5');

  // Sprint 5 añadirá:
  // 1. Query weekly_plans WHERE status = 'client_reviewing'
  // 2. Calcular días desde sent_to_client_at
  // 3. UPDATE atómico reminder_N_sent_at IS NULL → now() WHERE condición
  // 4. Si el UPDATE devuelve fila, enviar email correspondiente
  // 5. Día 6 sin respuesta: llamar a autoApprovePlan(weekId)

  return NextResponse.json({
    ok:          true,
    executed_at: new Date().toISOString(),
    action:      'noop (Sprint 5 pendiente)',
  });
}
