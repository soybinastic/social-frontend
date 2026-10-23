import type { ChatMessage, MediaAsset } from '@/types/api'

function nounFor(media: MediaAsset[]): string {
  const kinds = new Set(media.map((asset) => asset.kind))
  if (kinds.size > 1) return 'attachment'
  return kinds.has('audio') ? 'voice note' : 'photo'
}

/**
 * One line standing in for a message, used by inbox previews and reply quotes.
 *
 * A message with no text still has to read as something, which is why the
 * attachments get described rather than left blank.
 */
export function summarizeMessage(message: Pick<ChatMessage, 'body' | 'media'>): string {
  if (message.body) return message.body

  const count = message.media.length
  if (count === 0) return ''

  const noun = nounFor(message.media)
  if (count > 1) return `${count} ${noun}s`
  return noun.charAt(0).toUpperCase() + noun.slice(1)
}
