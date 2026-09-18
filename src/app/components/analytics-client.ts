'use client'

import posthog from 'posthog-js'
import type { EventName, EventProps, PersonProps } from '@/lib/analytics/events'
import { APP_NAME } from '@/lib/analytics/config'
import { initPostHog } from '@/lib/analytics/posthog-client'

function ready(): boolean {
  try {
    return initPostHog()
  } catch {
    return false
  }
}

export function trackClientEvent<N extends EventName>(name: N, props: EventProps<N>) {
  if (!ready()) return
  try {
    posthog.capture(name, props)
  } catch (error) {
    console.warn('[analytics] Failed to track client event:', name, error)
  }
}

export function identifyClientUser(userId: string, props: PersonProps) {
  if (!ready()) return
  try {
    posthog.identify(userId, props, { first_seen_app: APP_NAME })
  } catch (error) {
    console.warn('[analytics] Failed to identify client user:', error)
  }
}

/** Only resets when a person is identified, so anonymous ids survive sign-out checks. */
export function resetClientUser() {
  if (!ready()) return
  try {
    if (posthog._isIdentified()) posthog.reset()
  } catch (error) {
    console.warn('[analytics] Failed to reset client user:', error)
  }
}

/** The browser's PostHog id, for API routes that track on the caller's behalf. */
export function getClientDistinctId(): string | undefined {
  if (!ready()) return undefined
  try {
    return posthog.get_distinct_id()
  } catch {
    return undefined
  }
}
