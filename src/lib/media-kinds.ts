import type { MediaKind } from '@/types/api'

const MB = 1024 * 1024

export const MAX_POST_ATTACHMENTS = 10

/** Mirrors `MAX_ATTACHMENTS_PER_MESSAGE`: a message is a message, not an album. */
export const MAX_MESSAGE_ATTACHMENTS = 4

/** A chat carries photos and voice notes; video belongs in a post. */
export const CHAT_KINDS: MediaKind[] = ['image', 'audio']

/**
 * Mirrors `apps/media/kinds.py`.
 *
 * The server revalidates everything; this copy exists so a 200MB file is
 * rejected before it is uploaded rather than after.
 */
export const MEDIA_RULES: Record<
  MediaKind,
  { accept: string; maxBytes: number; extensions: string[]; label: string }
> = {
  image: {
    accept: 'image/*',
    maxBytes: 10 * MB,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'],
    label: 'Photo',
  },
  video: {
    accept: 'video/*',
    maxBytes: 200 * MB,
    extensions: ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'],
    label: 'Video',
  },
  audio: {
    accept: 'audio/*',
    maxBytes: 50 * MB,
    extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
    label: 'Audio',
  },
}

export function detectKind(file: File): MediaKind | null {
  const kinds = Object.keys(MEDIA_RULES) as MediaKind[]

  const byMime = kinds.find((kind) => file.type.startsWith(`${kind}/`))
  if (byMime) return byMime

  // Browsers sometimes report application/octet-stream, so fall back to the
  // extension the same way the server does.
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return kinds.find((kind) => MEDIA_RULES[kind].extensions.includes(extension)) ?? null
}

/** "image, video, or audio", so a message names the kinds it will accept. */
function listKinds(kinds: MediaKind[]): string {
  if (kinds.length < 3) return kinds.join(' or ')
  return `${kinds.slice(0, -1).join(', ')}, or ${kinds.at(-1)}`
}

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(file: File, allowed?: MediaKind[]): string | null {
  const kinds = allowed ?? (Object.keys(MEDIA_RULES) as MediaKind[])
  const kind = detectKind(file)
  if (!kind || !kinds.includes(kind)) {
    return `"${file.name}" is not a supported ${listKinds(kinds)} file.`
  }

  const { maxBytes } = MEDIA_RULES[kind]
  if (file.size > maxBytes) {
    return `${MEDIA_RULES[kind].label} files must be ${maxBytes / MB}MB or smaller.`
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`
  }
  return null
}

export const ALL_ACCEPTED = Object.values(MEDIA_RULES)
  .map((rule) => rule.accept)
  .join(',')
