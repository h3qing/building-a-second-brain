'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackClientEvent } from './analytics-client'
import type { ContentType } from '@/lib/analytics/events'

type OutboundLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children?: ReactNode
}

/** Mirrors the content_id that ContentViewTracker uses on the note pages. */
function contentFromPath(pathname: string): { content_id: string; content_type: ContentType } | null {
  const note = pathname.match(/^\/(concepts|ideas)\/([^/]+)/)
  if (note) return { content_id: `${note[1]}/${note[2]}`, content_type: 'note' }
  return null
}

/** External link. Tracks the click, then lets the browser follow it. */
export function OutboundLink({ href, children, onClick, ...rest }: OutboundLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        onClick?.(event)
        let hrefDomain = ''
        try {
          hrefDomain = new URL(href, window.location.href).hostname
        } catch {
          hrefDomain = 'invalid'
        }
        trackClientEvent('outbound_link_clicked', {
          href_domain: hrefDomain,
          ...(contentFromPath(window.location.pathname) ?? {}),
        })
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
