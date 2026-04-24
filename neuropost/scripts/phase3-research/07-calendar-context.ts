#!/usr/bin/env npx tsx
// Phase 3.0 — Paso 5: list upcoming calendar_events for SportArea
// to show what the creative director would see in its context.

import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = createClient(url, key);

  const brandId = process.env.TEST_BRAND_ID ?? 'e8dc77ef-8371-4765-a90c-c7108733f791';
  const today = new Date().toISOString().slice(0, 10);
  const plus7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const plus30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  console.log(`Today: ${today}`);
  console.log(`Week window: ${today} → ${plus7}`);
  console.log(`Month window: ${today} → ${plus30}\n`);

  const week = await s
    .from('calendar_events')
    .select('title, date, type, relevance, description, suggested_content_idea')
    .eq('brand_id', brandId)
    .gte('date', today)
    .lte('date', plus7)
    .order('date');

  console.log(`--- Week events (${week.data?.length ?? 0}) ---`);
  for (const e of week.data ?? []) {
    console.log(`  [${e.date}] ${e.title}  (${e.type}/${e.relevance})`);
    if (e.description) console.log(`      ${e.description.slice(0, 120)}`);
    if (e.suggested_content_idea) console.log(`      → ${e.suggested_content_idea.slice(0, 120)}`);
  }

  const month = await s
    .from('calendar_events')
    .select('title, date, type, relevance')
    .eq('brand_id', brandId)
    .gte('date', today)
    .lte('date', plus30)
    .order('relevance', { ascending: false })
    .order('date');
  console.log(`\n--- Month events, by relevance (${month.data?.length ?? 0}) ---`);
  for (const e of month.data ?? []) {
    console.log(`  [${e.date}] ${e.relevance}  ${e.type.padEnd(10)}  ${e.title}`);
  }

  const { count } = await s
    .from('calendar_events')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId);
  console.log(`\nTotal calendar_events for SportArea: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });
