import { AxiosError } from 'axios'

import type { ApiErrorBody } from '@/types/api'

/**
 * Turn any thrown value into a message worth showing a user.
 *
 * The API always answers with the same `{ error: { code, message, details } }`
 * envelope, so field errors from DRF validation are flattened out of `details`.
 */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!(error instanceof AxiosError)) {
    return error instanceof Error ? error.message : fallback
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Is the API running?'
  }

  const body = error.response?.data as ApiErrorBody | undefined
  if (!body?.error) {
    return error.message || fallback
  }

  const fieldErrors = Object.values(body.error.details ?? {})
    .flat()
    .filter((value): value is string => typeof value === 'string')

  return fieldErrors.length > 0 ? fieldErrors.join(' ') : body.error.message
}

/** Per-field messages, for rendering errors next to the input that caused them. */
export function toFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError)) return {}

  const details = (error.response?.data as ApiErrorBody | undefined)?.error?.details
  if (!details) return {}

  return Object.fromEntries(
    Object.entries(details).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? String(messages[0]) : String(messages),
    ]),
  )
}
