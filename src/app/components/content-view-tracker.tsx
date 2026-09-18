'use client'

import { useEffect } from 'react'
import { trackClientEvent } from './analytics-client'
import type { ContentProps } from '@/lib/analytics/events'

/**
 * Fires content_viewed once per mount. Scroll depth and time on page come from
 * PostHog's own $pageleave event, so nothing else is tracked here.
 */
export function ContentViewTracker({
  content_id,
  content_type,
  content_title,
  content_published_at,
}: ContentProps) {
  useEffect(() => {
    trackClientEvent('content_viewed', {
      content_id,
      content_type,
      content_title,
      content_published_at,
    })
  }, [content_id, content_type, content_title, content_published_at])

  return null
}
