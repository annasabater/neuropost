// =============================================================================
// Handler registry
// =============================================================================
// Maps (agent_type, action) → handler function. Each agent module registers
// its handlers here at import time. The runner uses lookupHandler() to
// dispatch jobs without knowing anything about specific agents.
//
// Future agent modules will live in src/lib/agents/{content,strategy,...}/
// and call registerHandler() in their index.ts barrel.

import type { AgentHandler, AgentType, HandlerKey } from './types';

const registry = new Map<string, AgentHandler>();

function keyOf(k: HandlerKey): string {
  return `${k.agent_type}:${k.action}`;
}

export function registerHandler(key: HandlerKey, handler: AgentHandler): void {
  const k = keyOf(key);
  if (registry.has(k)) {
    // Last-write-wins is fine during HMR; warn so double-registration in
    // production is visible in logs.
    console.warn(`[agents/registry] overwriting handler for ${k}`);
  }
  registry.set(k, handler);
}

export function lookupHandler(agent_type: AgentType, action: string): AgentHandler | null {
  return registry.get(keyOf({ agent_type, action })) ?? null;
}

export function listRegisteredHandlers(): HandlerKey[] {
  return Array.from(registry.keys()).map((k) => {
    const [agent_type, action] = k.split(':') as [AgentType, string];
    return { agent_type, action };
  });
}

// -----------------------------------------------------------------------------
// Import-side registration
// -----------------------------------------------------------------------------
// F1 intentionally ships with ZERO handlers registered. The runner will mark
// jobs with unknown handlers as 'error' with a clear message, which is the
// expected F1 behavior: the queue is live and auditable, but nothing runs
// yet. Later phases (F2+) register real handlers by importing the agent
// modules here.
//
// When adding a handler module, import it for side-effects:
//
//   import '@/lib/agents/content';
//   import '@/lib/agents/strategy';
//
// Each module calls registerHandler() at import time.
