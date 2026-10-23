/** Mirrors the payloads produced by the Django serializers. */

export type MediaKind = 'image' | 'video' | 'audio'

export interface MediaAsset {
  kind: MediaKind
  url: string
  thumbnail_url: string
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  original_filename: string
}

export interface User {
  id: string
  username: string
  display_name: string
  /** Falls back to the username when no display name is set. */
  name: string
  bio: string
  avatar: MediaAsset | null
  follower_count: number
  following_count: number
  date_joined: string
}

/** A user plus how the signed-in viewer relates to them. */
export interface Profile extends User {
  is_following: boolean
  /** They follow the viewer. With `is_following` false, this is a follow back. */
  follows_you: boolean
}

export interface FollowState {
  is_following: boolean
  follows_you: boolean
  follower_count: number
  following_count: number
}

export interface SharedPost {
  id: string
  author: User
  caption: string
  media: MediaAsset[]
  like_count: number
  share_count: number
  comment_count: number
  created_at: string
}

export interface Post {
  id: string
  author: User
  caption: string
  media: MediaAsset[]
  shared_from: SharedPost | null
  like_count: number
  share_count: number
  /** The whole conversation under the post, replies included. */
  comment_count: number
  liked: boolean
  is_mine: boolean
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  post: string
  /** Null on a comment about the post; set on a reply. Threads go no deeper. */
  parent: string | null
  author: User
  body: string
  like_count: number
  reply_count: number
  liked: boolean
  /** Its writer, or the post's author moderating their own thread. */
  can_delete: boolean
  created_at: string
}

export interface CommentState {
  liked: boolean
  like_count: number
}

export type NotificationKind =
  | 'follow'
  | 'like'
  | 'share'
  | 'comment'
  | 'reply'
  | 'comment_like'

export interface Notification {
  id: string
  kind: NotificationKind
  actor: User
  /** The post to open; null for follows, which open the actor's profile. */
  post: { id: string; caption: string } | null
  /** What the row is about when it concerns a comment, so it can be quoted. */
  comment: { id: string; body: string } | null
  is_read: boolean
  created_at: string
}

/** The message a reply quotes. It carries no quote of its own, so nesting stops. */
export interface QuotedMessage {
  id: string
  sender: User
  body: string
  media: MediaAsset[]
  created_at: string
}

export interface ChatMessage {
  id: string
  conversation: string
  sender: User
  body: string
  media: MediaAsset[]
  reply_to: QuotedMessage | null
  created_at: string
}

export interface Conversation {
  id: string
  /** The participant who is not the viewer: a thread is named after them. */
  other: User
  /** When they last caught up. A message older than this has been seen. */
  other_read_at: string | null
  last_message: ChatMessage | null
  unread_count: number
  last_message_at: string
  created_at: string
}

/** What arrives on the chat socket. */
export type ChatEvent =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'message.created'; message: ChatMessage }
  | { type: 'conversation.read'; conversation: string; reader: string; read_at: string }
  | { type: 'typing'; conversation: string; user: string; state: 'start' | 'stop' }

/**
 * Everything a client may send. Messages are not here: they are an HTTP call,
 * because they can carry attachments. Typing is, because it is worth nothing a
 * few seconds later and so is never stored.
 */
export type ChatCommand =
  | { type: 'ping' }
  | { type: 'typing'; conversation: string; state: 'start' | 'stop' }

export interface InteractionState {
  liked: boolean
  like_count: number
  share_count: number
}

export interface Session {
  user: User
  access_token: string
  refresh_token: string
}

/** Cursor pagination: `next` is a full URL, and there is no total count. */
export interface Page<T> {
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Record<string, unknown>
  }
}
