// lib/analytics.ts
// Privacy-preserving analytics wrapper.
// PostHog self-hosted: swap POSTHOG_HOST to your server; set POSTHOG_KEY in env.
// All events are anonymised — no PII, no device fingerprinting beyond a random UUID.

import * as SecureStore from 'expo-secure-store';

const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '';
const POSTHOG_KEY  = process.env.EXPO_PUBLIC_POSTHOG_KEY  ?? '';
const ANON_ID_KEY  = 'bloom_anon_id';
const OPT_OUT_KEY  = 'bloom_analytics_opt_out';

let anonId: string | null = null;
let optedOut: boolean | null = null;

/** Privacy: user can opt out of even anonymised analytics. */
export async function setAnalyticsOptOut(value: boolean): Promise<void> {
  optedOut = value;
  await SecureStore.setItemAsync(OPT_OUT_KEY, value ? '1' : '0');
}

async function isOptedOut(): Promise<boolean> {
  if (optedOut !== null) return optedOut;
  const stored = await SecureStore.getItemAsync(OPT_OUT_KEY);
  optedOut = stored === '1';
  return optedOut;
}

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  const stored = await SecureStore.getItemAsync(ANON_ID_KEY);
  if (stored) { anonId = stored; return anonId; }
  // Generate a random UUID v4 (no native crypto needed)
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  await SecureStore.setItemAsync(ANON_ID_KEY, uuid);
  anonId = uuid;
  return anonId;
}

async function send(event: string, properties: Record<string, unknown> = {}): Promise<void> {
  if (!POSTHOG_HOST || !POSTHOG_KEY) return; // analytics disabled — no-op
  if (await isOptedOut()) return;            // user opted out — respect it
  try {
    const distinctId = await getAnonId();
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: 'bloom-rn',
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Analytics must never break the app
  }
}

// ── Typed event helpers ───────────────────────────────────────────────────────

export const Analytics = {
  /** Screen view */
  screen: (name: string) => send('screen_view', { screen: name }),

  /** User tapped a premium feature gate */
  premiumGateTapped: (feature: string) => send('premium_gate_tapped', { feature }),

  /** Hard paywall shown */
  paywallViewed: (source: string) => send('paywall_viewed', { source }),

  /** User tapped a paywall CTA */
  paywallCtaTapped: (plan: 'monthly' | 'annual') => send('paywall_cta_tapped', { plan }),

  /** Purchase completed */
  purchaseCompleted: (plan: 'monthly' | 'annual', currency: string, price: number) =>
    send('purchase_completed', { plan, currency, price }),

  /** Purchase failed */
  purchaseFailed: (reason: string) => send('purchase_failed', { reason }),

  /** User restored purchase */
  purchaseRestored: () => send('purchase_restored'),

  /** Free-tier AI limit reached */
  aiLimitReached: () => send('ai_limit_reached'),

  /** User dismissed paywall */
  paywallDismissed: (source: string) => send('paywall_dismissed', { source }),

  /** Generic feature usage (premium features only) */
  featureUsed: (feature: string) => send('feature_used', { feature }),
};
