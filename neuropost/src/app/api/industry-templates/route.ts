import { NextResponse } from 'next/server';
import { INDUSTRY_TEMPLATES } from '@/lib/industry-templates';

// Public — no auth required. Templates are read-only config data.
export async function GET() {
  return NextResponse.json({ templates: INDUSTRY_TEMPLATES });
}
