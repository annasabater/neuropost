// ─────────────────────────────────────────────────────────────────────────────
// Postly — PlannerAgent prompts
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentContext } from '../shared/types';
import type { PlannerInput } from './types';

// ─── Sector alias: UI saves Spanish keys, timing maps use English ─────────────

const SECTOR_ALIAS: Record<string, string> = {
  restaurante: 'restaurant',
  bar:         'restaurant',
  cafeteria:   'restaurant',
  cafè:        'restaurant',
  heladeria:   'ice-cream',
  gelateria:   'ice-cream',
  pasteleria:  'restaurant',
  boutique:    'retail',
  moda:        'retail',
  tienda:      'retail',
  ecommerce:   'retail',
  'e-commerce':'retail',
  bazar:       'retail',
};

function normalizeSector(raw: string): string {
  return SECTOR_ALIAS[raw.toLowerCase()] ?? raw;
}

// ─── Sector best-time knowledge ───────────────────────────────────────────────

const SECTOR_TIMING: Record<string, string> = {
  restaurant: `
- Lunch slots (11:30–12:00) drive reservations for same-day lunch service.
- Dinner slots (18:30–19:30) perform best for evening bookings.
- Weekend brunch content (Sat/Sun 09:30–10:30) gets high saves.
- Avoid Monday — lowest engagement for food businesses.`,

  'ice-cream': `
- Peak engagement: weekdays 15:00–17:00 (after-school / afternoon break).
- Weekend posts at 11:00 capture family planning behaviour.
- Hot weather context posts outperform year-round; note seasonal holidays.
- Summer months: increase frequency Thu–Sat.`,

  retail: `
- Commute windows (08:00–09:00 and 17:30–18:30) drive highest click-throughs.
- Lunch browsing (12:30–13:30) works well for impulse purchases.
- Fridays perform strongly for weekend-purchase intent.
- Avoid Tuesday mornings — historically lowest retail engagement.`,

  other: `
- Tuesday–Thursday 09:00–11:00 are broadly the safest posting windows.
- Avoid posting on public holidays unless the content is holiday-specific.`,
};

// ─── System prompt ────────────────────────────────────────────────────────────

/**
 * Establishes Claude as a data-driven social media scheduling expert
 * with deep knowledge of the business's sector timing patterns.
 */
export function buildPlannerSystemPrompt(context: AgentContext): string {
  const sector = normalizeSector(context.brandVoice.sector);
  const timing = SECTOR_TIMING[sector] ?? SECTOR_TIMING['other']!;

  return `You are an expert social media scheduling strategist for ${context.businessName}, a ${context.brandVoice.sector} business operating in timezone ${context.timezone}.

## Your role
Build an optimal monthly posting calendar that maximises organic reach and engagement by aligning publication times with audience behaviour for this sector.

## Sector timing intelligence — ${sector}
${timing.trim()}

## Scheduling rules
1. Never schedule two posts on the same platform within 20 hours of each other.
2. Distribute posts evenly across the month — avoid clustering in week 1 then going quiet.
3. Respect blackoutDates absolutely — no posts on those days.
4. If a ContentPiece has a preferredDate, honour it unless it falls on a blackout or holiday.
5. Holiday posts are acceptable ONLY if the content is thematically relevant (check visualTags).
6. Return scheduledAt as a full ISO-8601 datetime in UTC, computed from the given timezone and local time.
7. Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = `{
  "calendar": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": string,
      "isWeekend": boolean,
      "isHoliday": boolean,
      "holidayName": string | null,
      "posts": [ScheduledPost]
    }
  ],
  "scheduledPosts": [
    {
      "id": string,                  // UUID v4
      "contentPieceId": string,
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "scheduledAt": "ISO-8601 UTC",
      "platform": "instagram" | "facebook",
      "rationale": string,
      "isHoliday": boolean,
      "holidayName": string | null
    }
  ],
  "bestTimeInsights": [
    {
      "platform": "instagram" | "facebook",
      "bestDay": string,
      "bestTime": "HH:mm",
      "reason": string
    }
  ],
  "unscheduledPieceIds": string[],
  "summary": string
}`;

/**
 * Builds the user turn containing the full scheduling brief.
 */
export function buildPlannerUserPrompt(input: PlannerInput, context: AgentContext): string {
  const monthName = new Date(input.year, input.month - 1, 1).toLocaleString('en-US', {
    month: 'long',
  });

  const piecesBlock = input.contentPieces
    .map(
      (p) =>
        `  - id: "${p.id}" | goal: ${p.goal} | platforms: ${p.platforms.join('+')} | tags: [${p.visualTags.slice(0, 5).join(', ')}]${p.preferredDate ? ` | preferredDate: ${p.preferredDate}` : ''}`,
    )
    .join('\n');

  const blackoutBlock =
    input.blackoutDates && input.blackoutDates.length > 0
      ? `Blackout dates (no posts): ${input.blackoutDates.join(', ')}`
      : 'No blackout dates.';

  return `Plan the posting calendar for ${monthName} ${input.year}.

Business: ${context.businessName} (${context.brandVoice.sector})
Country for public holidays: ${input.country}
Timezone: ${context.timezone}
Platforms active: ${input.platforms.join(', ')}
Target frequency: ${input.postsPerWeek} posts/week across all platforms

${blackoutBlock}

Content pieces to schedule (${input.contentPieces.length} total):
${piecesBlock}

Instructions:
- Detect all public holidays in ${input.country} for ${monthName} ${input.year} and mark them in the calendar.
- Assign each ContentPiece to one or more platform slots.
- Apply sector timing intelligence to choose optimal times.
- If a piece targets both instagram and facebook, schedule each platform separately (different times, same day is fine).
- Generate one "bestTimeInsights" entry per active platform.
- Fill "unscheduledPieceIds" with any IDs you could not place.
- Write a concise "summary" paragraph (3–4 sentences) for the business owner.

Return this exact JSON structure:
${OUTPUT_SCHEMA}`;
}
