// ─────────────────────────────────────────────────────────────────────────────
// Postly — PlannerAgent types
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform, PostGoal } from '../copywriter/types';

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * Lightweight reference to a piece of content ready to be scheduled.
 * Intentionally decoupled from EditorOutput / CopywriterOutput — the
 * PlannerAgent only needs semantics, not raw copy.
 */
export interface ContentPiece {
  /** Stable identifier linking back to the full content record in Supabase */
  id: string;
  /** Primary objective for this piece — informs scheduling strategy */
  goal: PostGoal;
  /** Visual descriptors from EditorAgent — used to avoid repetitive scheduling */
  visualTags: string[];
  /** Platforms this piece has copy ready for */
  platforms: Platform[];
  /**
   * Optional human hint about when this should run.
   * E.g. "before Easter weekend", "on our anniversary 15th"
   */
  preferredDate?: string; // ISO date YYYY-MM-DD
}

export interface PlannerInput {
  /** 1–12 */
  month: number;
  year: number;
  /** Content pieces available to schedule this month */
  contentPieces: ContentPiece[];
  /**
   * Desired posting frequency.
   * The planner treats this as a target, not a hard constraint.
   */
  postsPerWeek: number;
  /**
   * ISO 3166-1 alpha-2 country code for public holiday detection.
   * E.g. 'ES', 'MX', 'AR'
   */
  country: string;
  /** Platforms active for this business */
  platforms: Platform[];
  /**
   * Dates on which no posts should be scheduled.
   * ISO dates: ['2025-07-04', '2025-07-15']
   */
  blackoutDates?: string[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

/**
 * A single post slot in the calendar.
 * Published by PublisherAgent using contentPieceId to look up the full copy.
 */
export interface ScheduledPost {
  /** UUID — used as the BullMQ job ID */
  id: string;
  contentPieceId: string;
  /** ISO date YYYY-MM-DD in the business timezone */
  date: string;
  /** HH:mm local time — business timezone */
  time: string;
  /** ISO-8601 datetime used to enqueue the BullMQ job */
  scheduledAt: string;
  platform: Platform;
  /** Why this date/time was chosen — shown to human reviewers */
  rationale: string;
  isHoliday: boolean;
  holidayName?: string;
}

/** Aggregated best-time insight for the month report */
export interface BestTimeInsight {
  platform: Platform;
  /** Day of week, e.g. "Tuesday" */
  bestDay: string;
  /** HH:mm local time */
  bestTime: string;
  reason: string;
}

/** One calendar day, combining metadata + any posts scheduled on that day */
export interface CalendarDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** e.g. "Monday" */
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  posts: ScheduledPost[];
}

export interface PlannerOutput {
  month: number;
  year: number;
  /** Full calendar grid — one entry per day of the month */
  calendar: CalendarDay[];
  /** Flat list of all scheduled posts, sorted by scheduledAt asc */
  scheduledPosts: ScheduledPost[];
  /** Sector-specific best-time guidance for this month */
  bestTimeInsights: BestTimeInsight[];
  /**
   * IDs of ContentPieces that could not be placed.
   * Happens when postsPerWeek exceeds available good slots.
   */
  unscheduledPieceIds: string[];
  /** One-paragraph summary for the human review dashboard */
  summary: string;
}
