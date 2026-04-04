// =============================================================================
// NEUROPOST — Admin helpers (superadmin-only operations)
// =============================================================================

import { requireServerUser, createServerClient } from '@/lib/supabase';

/**
 * Verifies the current user is a superadmin.
 * Throws 'FORBIDDEN' if not.
 */
export async function requireSuperAdmin() {
  const user = await requireServerUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'superadmin') throw new Error('FORBIDDEN');
  return user;
}

/**
 * Maps API errors to the correct HTTP status + message.
 */
export function adminErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'UNAUTHENTICATED') return { error: 'Unauthorized', status: 401 } as const;
  if (message === 'FORBIDDEN')       return { error: 'Forbidden',    status: 403 } as const;
  return { error: message, status: 500 } as const;
}

// ─── Types shared across admin routes ─────────────────────────────────────────

export type ProspectStatus   = 'contacted' | 'replied' | 'interested' | 'converted' | 'not_interested';
export type ProspectChannel  = 'instagram' | 'email' | 'meta_ads';
export type MessageStatus    = 'unread' | 'read' | 'replied' | 'archived';
export type InteractionType  =
  | 'comment_sent'
  | 'comment_reply_received'
  | 'email_sent'
  | 'email_opened'
  | 'email_replied'
  | 'dm_received'
  | 'dm_sent'
  | 'status_changed'
  | 'ad_lead'
  | 'note_added';

export interface Prospect {
  id:              string;
  ig_account_id:   string | null;
  username:        string | null;
  full_name:       string | null;
  profile_pic_url: string | null;
  bio:             string | null;
  followers:       number;
  following:       number;
  post_count:      number;
  sector:          string | null;
  city:            string | null;
  email:           string | null;
  website:         string | null;
  channel:         ProspectChannel;
  status:          ProspectStatus;
  notes:           string | null;
  last_activity:   string;
  created_at:      string;
  updated_at:      string;
}

export interface OutboundComment {
  id:                       string;
  prospect_id:              string | null;
  ig_post_url:              string | null;
  ig_post_id:               string | null;
  comment_ig_id:            string | null;
  content:                  string;
  prospect_reply:           string | null;
  prospect_reply_id:        string | null;
  prospect_reply_liked:     boolean;
  prospect_reply_liked_at:  string | null;
  status:                   string;
  sent_at:                  string;
  replied_at:               string | null;
}

export interface Message {
  id:                   string;
  platform:             string;
  external_id:          string | null;
  thread_id:            string | null;
  sender_username:      string | null;
  sender_id:            string | null;
  content:              string | null;
  our_reply:            string | null;
  status:               MessageStatus;
  ai_reply_suggestion:  string | null;
  prospect_id:          string | null;
  created_at:           string;
  replied_at:           string | null;
}

export interface ProspectInteraction {
  id:          string;
  prospect_id: string;
  type:        InteractionType;
  content:     string | null;
  metadata:    Record<string, unknown>;
  created_at:  string;
}
