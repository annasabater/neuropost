/**
 * Placeholder for Sprint 5 reminder processing.
 * Functions are declared here so other modules can import them without
 * breaking types. Implementations are stubs that do nothing.
 */

export type ReminderType = 'day_2' | 'day_4' | 'day_6';

export async function processReminders(): Promise<{
  sent:         number;
  skipped:      number;
  autoApproved: number;
}> {
  // Sprint 5: query weekly_plans, check reminder windows, send emails
  return { sent: 0, skipped: 0, autoApproved: 0 };
}

export async function autoApprovePlan(weekId: string): Promise<{
  ok:                  boolean;
  ideas_auto_approved: number;
  ideas_preserved:     number;
}> {
  void weekId; // Sprint 5: approve pending ideas, preserve client-actioned ones
  return { ok: false, ideas_auto_approved: 0, ideas_preserved: 0 };
}
