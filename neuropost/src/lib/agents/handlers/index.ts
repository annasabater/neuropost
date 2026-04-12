// =============================================================================
// F2 — Handlers barrel
// =============================================================================
// Single import point that registers every handler in the registry. Any
// module that needs the queue to actually execute jobs imports this file
// for its side effects:
//
//   import '@/lib/agents/handlers';
//
// Today that's just /api/cron/agent-queue-runner, but future entry points
// (e.g. a manual worker-triggered runner, tests) do the same.
//
// Order of registration does NOT matter — handlers are keyed by
// (agent_type, action) and there are no collisions between backend and
// local handler files.

import { registerBackendAgentHandlers       } from './backend';
import { registerLocalAgentHandlers         } from './local';
import { registerStrategyHandlers           } from './strategy';
import { registerAnalyticsRecomputeHandlers } from './analytics';
import { registerPublishingHandlers         } from './publishing';
import { registerAdvancedHandlers           } from './advanced';
import { registerMaterializeHandler         } from './materialize';
import { registerMediaHandlers              } from './media';

let registered = false;

export function registerAllHandlers(): void {
  if (registered) return;   // idempotent for HMR / hot imports
  registerBackendAgentHandlers();
  registerLocalAgentHandlers();
  registerStrategyHandlers();
  registerAnalyticsRecomputeHandlers();
  registerPublishingHandlers();
  registerAdvancedHandlers();
  registerMaterializeHandler();
  registerMediaHandlers();
  registered = true;
}

// Register at module import time so a single `import '@/lib/agents/handlers'`
// is enough. The guard above makes duplicate imports safe.
registerAllHandlers();
