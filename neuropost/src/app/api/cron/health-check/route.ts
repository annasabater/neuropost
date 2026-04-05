import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const db = createAdminClient();

    // Simple DB connectivity check
    const { error } = await db.from('brands').select('id').limit(1);
    if (error) {
      // Auto-create incident if none active for 'dashboard'
      const { data: existing } = await db
        .from('service_incidents')
        .select('id')
        .eq('status', 'investigating')
        .contains('affected_services', ['dashboard'])
        .limit(1)
        .single()
        .catch(() => ({ data: null }));

      if (!existing) {
        await db.from('service_incidents').insert({
          title: 'Problemas de conectividad detectados',
          severity: 'major',
          affected_services: ['dashboard'],
          status: 'investigating',
        });
      }
    }

    return NextResponse.json({ ok: true, checked_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
