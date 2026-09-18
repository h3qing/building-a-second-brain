import posthog from 'posthog-js'
import { APP_NAME, POSTHOG_PROXY_PATH, POSTHOG_UI_HOST } from './config'
import type { AppEnv, SuperProps } from './events'

function appEnv(): AppEnv {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
  if (vercelEnv === 'production' || vercelEnv === 'preview' || vercelEnv === 'development') {
    return vercelEnv
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

export function clientSuperProps(): SuperProps {
  return {
    app: APP_NAME,
    app_env: appEnv(),
    app_version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    source: 'client',
  }
}

/**
 * Idempotent. Called from instrumentation-client.ts before hydration so every
 * component effect sees an initialized client, and again defensively from the
 * tracking wrapper. Returns false when there is no key (local dev without env).
 */
export function initPostHog(): boolean {
  if (typeof window === 'undefined') return false
  if (posthog.__loaded) return true

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return false

  const superProps = clientSuperProps()

  posthog.init(key, {
    api_host: POSTHOG_PROXY_PATH,
    ui_host: POSTHOG_UI_HOST,
    // Pageviews on client-side route changes. Pageleave carries scroll depth
    // and duration; Web Analytics goes blank without it.
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: true,
    person_profiles: 'identified_only',
    disable_session_recording: true,
    disable_surveys: true,
    // Stamp super properties per event instead of persisting them, so an app on
    // a sibling subdomain can never inherit this app's values through storage.
    before_send: (event) => {
      if (event?.properties) {
        Object.assign(event.properties, superProps)
      }
      return event
    },
  })

  return true
}
