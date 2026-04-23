// =============================================================================
// Structured logger — planning pipeline and beyond
// =============================================================================
// Emits JSON lines to stdout so any log aggregator (Vercel, Sentry, etc.)
// can parse them without regex. Never throws — safe to call anywhere.
//
// Usage:
//   log({ level: 'error', scope: 'plan-week', event: 'stories_insert_failed',
//         plan_id: 'xxx', error: 'message' });

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level:  LogLevel;
  scope:  string;
  event:  string;
  [key: string]: unknown;
}

export function log(entry: LogEntry): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    if (entry.level === 'error' || entry.level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  } catch {
    // Last resort — never break the calling code
    console.error('[logger] Failed to serialize log entry');
  }
}
