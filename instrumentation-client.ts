// Runs in the browser before hydration (Next.js 15.3+ convention), so PostHog is
// initialized before any component effect tries to capture.
import { initPostHog } from '@/lib/analytics/posthog-client'

initPostHog()
