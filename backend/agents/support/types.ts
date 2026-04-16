// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — SupportAgent types
// Dedicated support agent for NeuroPost client tickets / chat.
// Unlike CommunityAgent, this agent ALWAYS produces a reply — it never
// "ignores" or returns null.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Input ────────────────────────────────────────────────────────────────────

export type SupportSource = 'ticket' | 'chat';

export type SupportCategory =
  | 'billing'         // suscripción, pagos, facturas, cupones
  | 'technical'       // bugs, errores, fallos de publicación
  | 'account'         // login, contraseña, cuenta
  | 'connection'      // Instagram / Facebook / TikTok OAuth
  | 'feature_request' // "quiero que haya X"
  | 'howto'           // "cómo hago para X"
  | 'content'         // dudas sobre la generación/edición de posts
  | 'other';

export interface SupportMessageHistoryItem {
  sender: 'client' | 'worker';
  message: string;
  at: string; // ISO-8601
}

export interface SupportInput {
  source: SupportSource;
  /** The latest message from the client that needs a reply */
  clientMessage: string;
  /** Ticket subject (only for source='ticket') */
  subject?: string;
  /** Ticket priority — affects tone */
  priority?: 'urgent' | 'normal' | 'low';
  /** Client-declared category (a hint — agent can override via its own classification) */
  declaredCategory?: string;
  /** Prior messages in the thread (oldest-first). Max 10 recent used as context. */
  messageHistory?: SupportMessageHistoryItem[];
  /** Brand's plan — affects what the agent can suggest (e.g. upgrade path) */
  plan?: 'starter' | 'pro' | 'total' | 'agency';
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SupportSolutionStep {
  /** Short imperative label */
  title: string;
  /** Concrete ordered steps, plain text, one per line */
  steps: string[];
  /** Internal URL or path the user can click (relative to NeuroPost) */
  link?: string;
}

export interface SupportOutput {
  /**
   * The reply to send to the client.
   * ALWAYS populated. Written in the client's language. 2–6 sentences
   * plus a bulleted solution when applicable.
   */
  reply: string;

  /** Agent's own classification of the ticket */
  category: SupportCategory;

  /** Agent's detected sentiment (for worker dashboard) */
  sentiment: 'frustrated' | 'neutral' | 'happy';

  /** BCP-47 language tag of the reply (matches client's language) */
  language: string;

  /**
   * Structured solutions the agent proposed.
   * Useful for the worker UI to display a "agent's suggested fix" card
   * next to the textual reply.
   */
  solutions: SupportSolutionStep[];

  /**
   * True if the agent couldn't fully solve the problem and a human
   * worker should review. The `reply` is still sent to the client in
   * this case — this flag only triggers an internal worker notification.
   */
  needsHumanFollowUp: boolean;

  /** One-line reason for human follow-up, shown in worker dashboard */
  escalationReason?: string;

  /** Is the ticket effectively resolved by this reply? Used for auto-close logic. */
  resolved: boolean;
}
