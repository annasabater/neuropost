// =============================================================================
// F9 — Scheduling agent handlers
// =============================================================================
// scheduling:detect_holidays → DetectHolidaysHandler
//   Uses Claude to generate regional + local holiday calendars for any
//   country/region/city combination and persists them to calendar_events.

import { registerHandler } from '../registry';
import { detectHolidaysHandler } from '../scheduling/detect-holidays';

export function registerSchedulingHandlers(): void {
  registerHandler({ agent_type: 'scheduling', action: 'detect_holidays' }, detectHolidaysHandler);
}
