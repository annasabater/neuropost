// =============================================================================
// NeuroPost — Manual email send test
//
// Usage:
//   npx tsx scripts/test_email.ts --template=weekly-plan-ready --to=tu@email.com
//   npx tsx scripts/test_email.ts --template=reminder-day-2 --to=tu@email.com
//
// Templates disponibles:
//   weekly-plan-ready · reminder-day-2 · reminder-day-4
//   final-warning-day-6 · auto-approved · final-calendar-ready
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';
import React                        from 'react';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

type TemplateName =
  | 'weekly-plan-ready'
  | 'reminder-day-2'
  | 'reminder-day-4'
  | 'final-warning-day-6'
  | 'auto-approved'
  | 'final-calendar-ready';

const TEMPLATE_NAMES: TemplateName[] = [
  'weekly-plan-ready', 'reminder-day-2', 'reminder-day-4',
  'final-warning-day-6', 'auto-approved', 'final-calendar-ready',
];

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

async function buildTemplate(name: TemplateName): Promise<{ element: React.ReactElement; subject: string }> {
  switch (name) {
    case 'weekly-plan-ready': {
      const { default: T } = await import('../src/emails/WeeklyPlanReadyEmail');
      return {
        element: React.createElement(T, {
          brand_name:       'SportArea (prueba)',
          week_start_label: 'semana del 21 de abril',
          review_url:       `${APP}/dashboard`,
          pillar_summary:   '2 posts de foto y 1 reel centrados en motivación y rutinas',
        }),
        subject: 'Tu contenido de la semana del 21 de abril está listo para revisar',
      };
    }
    case 'reminder-day-2': {
      const { default: T } = await import('../src/emails/ReminderDay2Email');
      return {
        element: React.createElement(T, {
          brand_name: 'SportArea (prueba)',
          review_url: `${APP}/dashboard`,
        }),
        subject: 'Recordatorio — tu plan de esta semana te espera',
      };
    }
    case 'reminder-day-4': {
      const { default: T } = await import('../src/emails/ReminderDay4Email');
      return {
        element: React.createElement(T, {
          brand_name: 'SportArea (prueba)',
          review_url: `${APP}/dashboard`,
          days_left:  2,
        }),
        subject: 'Tu plan de la semana sin revisar — quedan 2 días',
      };
    }
    case 'final-warning-day-6': {
      const { default: T } = await import('../src/emails/FinalWarningDay6Email');
      return {
        element: React.createElement(T, {
          brand_name: 'SportArea (prueba)',
          review_url: `${APP}/dashboard`,
        }),
        subject: 'Último aviso — si hoy no respondes, seguimos con la propuesta original',
      };
    }
    case 'auto-approved': {
      const { default: T } = await import('../src/emails/AutoApprovedEmail');
      return {
        element: React.createElement(T, {
          brand_name:       'SportArea (prueba)',
          week_start_label: 'semana del 21 de abril',
          calendar_url:     `${APP}/dashboard`,
        }),
        subject: 'Hemos seguido adelante con tu plan semanal',
      };
    }
    case 'final-calendar-ready': {
      const { default: T } = await import('../src/emails/FinalCalendarReadyEmail');
      return {
        element: React.createElement(T, {
          brand_name:       'SportArea (prueba)',
          week_start_label: 'semana del 21 de abril',
          calendar_url:     `${APP}/dashboard`,
        }),
        subject: 'Tu calendario de publicación de la semana está listo',
      };
    }
  }
}

async function main() {
  loadEnvLocal();

  const args         = process.argv.slice(2);
  const templateArg  = args.find(a => a.startsWith('--template='))?.split('=')[1];
  const toArg        = args.find(a => a.startsWith('--to='))?.split('=')[1];

  if (!templateArg || !toArg) {
    console.error('Usage: npx tsx scripts/test_email.ts --template=<name> --to=<email>');
    console.error('Templates:', TEMPLATE_NAMES.join(' · '));
    process.exit(1);
  }

  if (!TEMPLATE_NAMES.includes(templateArg as TemplateName)) {
    console.error(`Template "${templateArg}" no reconocida. Opciones: ${TEMPLATE_NAMES.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== NeuroPost — Email Test ===`);
  console.log(`Template : ${templateArg}`);
  console.log(`To       : ${toArg}`);
  console.log(`From     : ${process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'}`);
  console.log('');

  const { sendEmail } = await import('../src/lib/email/service');
  const { element, subject } = await buildTemplate(templateArg as TemplateName);

  const result = await sendEmail({ to: toArg, subject, template: element });

  if (result.ok) {
    console.log(`✓ Email enviado correctamente`);
    console.log(`  Resend ID : ${result.id}`);
    process.exit(0);
  } else {
    console.error(`✗ Error al enviar: ${result.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test fallido:', err);
  process.exit(1);
});
