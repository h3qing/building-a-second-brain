/**
 * Shared PostHog constants. No imports on purpose: this file is used by the
 * client bundle and by anything server-side that needs the same hosts.
 */

/** First-party path proxied to PostHog by next.config.ts rewrites. Unobvious on purpose. */
export const POSTHOG_PROXY_PATH = '/parchment'

/** PostHog US cloud. Fixed by the tracking plan (heqing-blog/docs/TRACKING_PLAN.md, section 11). */
export const POSTHOG_INGEST_HOST = 'https://us.i.posthog.com'
export const POSTHOG_ASSETS_HOST = 'https://us-assets.i.posthog.com'
export const POSTHOG_UI_HOST = 'https://us.posthog.com'

export const APP_NAME = 'second_brain' as const
