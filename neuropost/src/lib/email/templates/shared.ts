// =============================================================================
// NEUROPOST — Shared email styles + template types
// Used by every per-locale template to keep the same brand look.
// =============================================================================

export const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

// Inline-style constants reused across templates
export const STYLE = {
  btn:       'display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:16px;',
  btnDanger: 'display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:16px;',
  h1:        'font-size:26px;font-weight:800;margin:24px 0 8px;',
  h1Danger:  'font-size:26px;font-weight:800;margin:24px 0 8px;color:#e53e3e;',
  p:         'color:#555;line-height:1.6;',
  small:     'color:#888;font-size:13px;',
};

// ─── Template output ────────────────────────────────────────────────────────

export interface TemplateOutput {
  subject: string;
  /** Body HTML — the caller wraps it with layout() so don't repeat <html>. */
  html:    string;
  /** ≤100 chars preview shown in the inbox list. */
  preview: string;
}

// ─── Props per template ────────────────────────────────────────────────────

export interface WelcomeProps {
  name: string;
}

export interface PlanActivatedProps {
  plan:            string;
  nextBillingDate: string;
}

export interface PaymentFailedProps {
  portalUrl: string;
}

export interface PostPublishedProps {
  postId:   string;
  platform: string;
}

export interface WeeklyReportProps {
  brandName: string;
  stats: { posts: number; reach: number; engagement: string; topPost?: string };
}

export interface ResetPasswordProps {
  resetLink: string;
}

export interface TeamInviteProps {
  inviterName: string;
  brandName:   string;
  role:        string;
  inviteUrl:   string;
}

export interface UrgentTicketProps {
  brandName:   string;
  subject:     string;
  description: string;
  category:    string;
  ticketId:    string;
  clientEmail: string;
}

export type SubscriptionCancelledProps = Record<string, never>;

export interface GenericNotificationProps {
  brandName: string;
  type:      string;
  message:   string;
}

export interface ReactivationProps {
  brandName: string;
  /** 7, 14 or 30. Other values fall back to the 7-day copy. */
  segment:   7 | 14 | 30;
  /** True when the brand is on a paid plan (used for the 30d variant). */
  isPaid:    boolean;
}

export interface OnboardingIncompleteProps {
  brandName: string;
  /** Exact items still missing so the copy can be specific. */
  missing:   Array<'sector' | 'voice' | 'colors' | 'logo'>;
}

export interface NoSocialConnectedProps {
  brandName: string;
  /** 3 or 10 — bumps the tone a notch. */
  daysSinceSignup: number;
}

export interface NoContentProps {
  brandName: string;
  /** How many items the library actually has (0..4). */
  libraryCount: number;
}

export interface PlanUnusedProps {
  brandName: string;
  plan:      string;
  /** Days since the last published post (or since the plan started). */
  daysIdle:  number;
}

export interface DigestItem {
  /** Gated EmailType the original notification mapped to. */
  type:    string;
  /** Short human label per row. Falls back to type when missing. */
  label?:  string;
  /** Plain-text body shown under the label. */
  message: string;
  /** Optional deep link (relative path, e.g. /posts). */
  href?:   string;
}

export interface DigestProps {
  brandName: string;
  frequency: 'daily' | 'weekly';
  items:     DigestItem[];
}

// ─── Shared template "registry" shape ──────────────────────────────────────

export interface EmailTemplates {
  welcome:                 (p: WelcomeProps)              => TemplateOutput;
  planActivated:           (p: PlanActivatedProps)        => TemplateOutput;
  paymentFailed:           (p: PaymentFailedProps)        => TemplateOutput;
  postPublished:           (p: PostPublishedProps)        => TemplateOutput;
  weeklyReport:            (p: WeeklyReportProps)         => TemplateOutput;
  resetPassword:           (p: ResetPasswordProps)        => TemplateOutput;
  teamInvite:              (p: TeamInviteProps)           => TemplateOutput;
  urgentTicket:            (p: UrgentTicketProps)         => TemplateOutput;
  subscriptionCancelled:   (p: SubscriptionCancelledProps) => TemplateOutput;
  genericNotification:     (p: GenericNotificationProps)    => TemplateOutput;
  reactivation:            (p: ReactivationProps)           => TemplateOutput;
  onboardingIncomplete:    (p: OnboardingIncompleteProps)   => TemplateOutput;
  noSocialConnected:       (p: NoSocialConnectedProps)      => TemplateOutput;
  noContent:               (p: NoContentProps)              => TemplateOutput;
  planUnused:              (p: PlanUnusedProps)             => TemplateOutput;
  digest:                  (p: DigestProps)                 => TemplateOutput;
}
