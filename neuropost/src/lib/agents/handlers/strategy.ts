// =============================================================================
// F4 — Strategy agent handlers
// =============================================================================
// Three handlers that form the strategic layer:
//   strategy:build_taxonomy  → LLM taxonomy + persist into content_categories
//   strategy:generate_ideas  → N prioritized ideas from weighted categories
//   strategy:plan_week       → ideas + fan-out sub-jobs for execution
//
// These are the only handlers that call the LLM directly from the strategy
// module. All other agents in content/support/analytics stay pure executors.

import { registerHandler } from '../registry';
import { buildTaxonomyHandler } from '../strategy/build-taxonomy';
import { generateIdeasHandler } from '../strategy/generate-ideas';
import { planWeekHandler       } from '../strategy/plan-week';

export function registerStrategyHandlers(): void {
  registerHandler({ agent_type: 'strategy', action: 'build_taxonomy' }, buildTaxonomyHandler);
  registerHandler({ agent_type: 'strategy', action: 'generate_ideas' }, generateIdeasHandler);
  registerHandler({ agent_type: 'strategy', action: 'plan_week'      }, planWeekHandler);
}
