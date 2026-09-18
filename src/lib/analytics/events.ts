/**
 * Typed event catalog.
 *
 * Source of truth is docs/TRACKING_PLAN.md, section 5. Add the row there first,
 * then the union member here, then the call site. An event name that is not in
 * this union does not compile.
 */

export type AppName = 'blog' | 'second_brain' | 'influence' | 'megaphone'

export type AppEnv = 'production' | 'preview' | 'development'

export type ContentType = 'post' | 'book_note' | 'release_note' | 'explainer' | 'note'

export type ToolName =
  | 'todos'
  | 'stream'
  | 'uploader'
  | 'kindle_sync'
  | 'wealth_quiz'
  | 'who_are_you'
  | 'pronounce'
  | 'nyc_trip'
  | 'career_journey'
  | 'system_design'

export type Outcome = 'ok' | 'failed'

/** Stamped on every event by the client and server wrappers. */
export type SuperProps = {
  app: AppName
  app_env: AppEnv
  app_version?: string | undefined
  source: 'client' | 'server'
}

/** Person properties. No email, no name. */
export type PersonProps = {
  is_owner?: boolean | undefined
  role?: string | undefined
}

export type ContentProps = {
  content_id: string
  content_type: ContentType
  content_title?: string | undefined
  content_published_at?: string | undefined
}

/** Counts and lengths only. Never the text a person typed. */
export type ToolUsedProps = {
  tool: ToolName
  action: string
  outcome: Outcome
  char_count?: number | undefined
  file_count?: number | undefined
  bytes?: number | undefined
  highlight_count?: number | undefined
  book_count?: number | undefined
  open_count?: number | undefined
  score?: number | undefined
  status_code?: number | undefined
  reason?: string | undefined
}

export type AnalyticsEvent =
  /** A content page mounted. Same moment as $pageview, but carries content metadata. */
  | { name: 'content_viewed'; props: ContentProps }
  /** A favorite was added or removed. Server-side. */
  | {
      name: 'content_favorited'
      props: {
        content_id: string
        content_type: ContentType
        action: 'added' | 'updated' | 'removed'
        rating?: number | null | undefined
      }
    }
  /** A link leaving the app was clicked. */
  | {
      name: 'outbound_link_clicked'
      props: {
        href_domain: string
        content_id?: string | undefined
        content_type?: ContentType | undefined
      }
    }
  /** A "sign in to ..." prompt was clicked. */
  | { name: 'signin_prompt_clicked'; props: { placement: string } }
  /** Magic link form submitted successfully. */
  | { name: 'signin_requested'; props: { method: 'magic_link' } }
  /** NextAuth sign-in event fired. Server-side. */
  | { name: 'signin_completed'; props: { method: 'magic_link'; is_new_user: boolean } }
  /** Magic link request or callback failed. */
  | { name: 'signin_failed'; props: { method: 'magic_link'; reason: string } }
  /** A personal tool action completed. */
  | { name: 'tool_used'; props: ToolUsedProps }

export type EventName = AnalyticsEvent['name']

export type EventProps<N extends EventName> = Extract<AnalyticsEvent, { name: N }>['props']
