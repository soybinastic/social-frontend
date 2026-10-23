import { create } from 'zustand'

import { chatApi, type MessageDraft } from '@/lib/api/chat'
import { toErrorMessage } from '@/lib/api/errors'
import type { ChatCommand, ChatEvent, ChatMessage, Conversation } from '@/types/api'

/** At most one "start" per this long, however fast somebody types. */
const TYPING_PING_MS = 3_000

/** A pause this long counts as having stopped, since no keystroke will say so. */
const TYPING_IDLE_MS = 4_000

/**
 * How long a received indicator survives without news. Longer than the sender's
 * ping interval so a continuous typist does not flicker, short enough that a
 * client which vanished mid-sentence stops claiming to be typing.
 */
const TYPING_TTL_MS = 6_000

interface ThreadState {
  /** Newest first, as the API returns them; the thread renders in reverse. */
  messages: ChatMessage[]
  next: string | null
  loading: boolean
  loadingMore: boolean
  error: string | null
}

const EMPTY_THREAD: ThreadState = {
  messages: [],
  next: null,
  loading: true,
  loadingMore: false,
  error: null,
}

interface ChatState {
  conversations: Conversation[]
  next: string | null
  loadingInbox: boolean
  loadingMoreInbox: boolean
  inboxError: string | null
  /** Unread messages across every thread; drives the header badge. */
  unread: number
  threads: Record<string, ThreadState>
  /** Who is currently typing, by conversation id. */
  typing: Record<string, string>
  /** The thread on screen: messages arriving for it are read, not unread. */
  openId: string | null
  connected: boolean

  loadInbox: (options?: { more?: boolean }) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  loadThread: (conversationId: string, options?: { more?: boolean }) => Promise<void>
  startWith: (username: string) => Promise<Conversation>
  send: (conversationId: string, draft: MessageDraft) => Promise<void>
  markRead: (conversationId: string) => Promise<void>
  refreshUnread: () => Promise<void>
  openThread: (conversationId: string | null) => void
  notifyTyping: (conversationId: string, typing: boolean) => void
  applyEvent: (event: ChatEvent, viewerId: string) => void
  setTransport: (send: ((command: ChatCommand) => void) | null) => void
  setConnected: (connected: boolean) => void
  reset: () => void
}

const INITIAL = {
  conversations: [] as Conversation[],
  next: null as string | null,
  loadingInbox: true,
  loadingMoreInbox: false,
  inboxError: null as string | null,
  unread: 0,
  threads: {} as Record<string, ThreadState>,
  typing: {} as Record<string, string>,
  openId: null as string | null,
  connected: false,
}

/**
 * Socket and timer state, kept outside the store because none of it is rendered
 * and all of it is per-session rather than per-component.
 */
let transport: ((command: ChatCommand) => void) | null = null
const typingSentAt = new Map<string, number>()
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useChatStore = create<ChatState>()((set, get) => ({
  ...INITIAL,

  loadInbox: async (options) => {
    const more = options?.more ?? false
    const { next, loadingMoreInbox } = get()

    if (more && (!next || loadingMoreInbox)) return
    set(more ? { loadingMoreInbox: true } : { loadingInbox: true, inboxError: null })

    try {
      const page = await chatApi.conversations(more ? next : null)
      set((state) => ({
        conversations: more ? merge(state.conversations, page.results) : page.results,
        next: page.next,
        loadingInbox: false,
        loadingMoreInbox: false,
        inboxError: null,
      }))
    } catch (error) {
      set({
        loadingInbox: false,
        loadingMoreInbox: false,
        inboxError: toErrorMessage(error, 'Could not load your messages.'),
      })
    }
  },

  loadConversation: async (conversationId) => {
    // A thread reached by link is not in the inbox list yet, and its header
    // needs to know who it is with.
    if (get().conversations.some((row) => row.id === conversationId)) return
    try {
      const conversation = await chatApi.conversation(conversationId)
      set((state) => ({ conversations: merge(state.conversations, [conversation]) }))
    } catch {
      // The thread view surfaces the failure that matters, which is the history.
    }
  },

  loadThread: async (conversationId, options) => {
    const more = options?.more ?? false
    const existing = get().threads[conversationId]

    if (more && (!existing?.next || existing.loadingMore)) return
    patchThread(
      set,
      conversationId,
      more ? { loadingMore: true } : { loading: true, error: null },
    )

    try {
      const page = await chatApi.messages(conversationId, more ? existing?.next : null)
      patchThread(set, conversationId, {
        messages: more ? dedupe([...(existing?.messages ?? []), ...page.results]) : page.results,
        next: page.next,
        loading: false,
        loadingMore: false,
        error: null,
      })
    } catch (error) {
      patchThread(set, conversationId, {
        loading: false,
        loadingMore: false,
        error: toErrorMessage(error, 'Could not load this conversation.'),
      })
    }
  },

  startWith: async (username) => {
    const conversation = await chatApi.startWith(username)
    set((state) => ({ conversations: merge(state.conversations, [conversation]) }))
    return conversation
  },

  send: async (conversationId, draft) => {
    const message = await chatApi.send(conversationId, draft)
    // Applied straight away rather than waiting for the socket to echo it back;
    // when the echo does arrive it is recognised by id and ignored.
    get().applyEvent({ type: 'message.created', message }, message.sender.id)
  },

  markRead: async (conversationId) => {
    // Optimistic: the badge should drop as soon as the thread is on screen.
    set((state) => ({
      conversations: state.conversations.map((row) =>
        row.id === conversationId ? { ...row, unread_count: 0 } : row,
      ),
    }))
    try {
      set({ unread: await chatApi.markRead(conversationId) })
    } catch {
      // The count is cosmetic, and the next refresh settles it.
    }
  },

  refreshUnread: async () => {
    try {
      set({ unread: await chatApi.unreadCount() })
    } catch {
      // A stale badge is not worth interrupting anyone over.
    }
  },

  openThread: (conversationId) => set({ openId: conversationId }),

  notifyTyping: (conversationId, typing) => {
    clearTimeout(idleTimers.get(conversationId))

    if (!typing) {
      // Only worth saying when the other side is holding an indicator open.
      if (typingSentAt.delete(conversationId)) {
        transport?.({ type: 'typing', conversation: conversationId, state: 'stop' })
      }
      return
    }

    const now = Date.now()
    if (now - (typingSentAt.get(conversationId) ?? 0) > TYPING_PING_MS) {
      typingSentAt.set(conversationId, now)
      transport?.({ type: 'typing', conversation: conversationId, state: 'start' })
    }
    idleTimers.set(
      conversationId,
      setTimeout(() => get().notifyTyping(conversationId, false), TYPING_IDLE_MS),
    )
  },

  applyEvent: (event, viewerId) => {
    if (event.type === 'typing') {
      clearTimeout(expiryTimers.get(event.conversation))
      if (event.state === 'stop') {
        set((state) => ({ typing: without(state.typing, event.conversation) }))
        return
      }

      set((state) => ({ typing: { ...state.typing, [event.conversation]: event.user } }))
      expiryTimers.set(
        event.conversation,
        setTimeout(() => {
          set((state) => ({ typing: without(state.typing, event.conversation) }))
        }, TYPING_TTL_MS),
      )
      return
    }

    if (event.type === 'conversation.read') {
      const mine = event.reader === viewerId
      set((state) => ({
        conversations: state.conversations.map((row) => {
          if (row.id !== event.conversation) return row
          // Your own tabs drop the badge; the other side's read turns your
          // messages from sent into seen.
          return mine
            ? { ...row, unread_count: 0 }
            : { ...row, other_read_at: event.read_at }
        }),
      }))
      if (mine) void get().refreshUnread()
      return
    }

    if (event.type !== 'message.created') return

    const message = event.message
    const mine = message.sender.id === viewerId
    // Arriving in the thread you are looking at is not something to be told about.
    const counts = !mine && get().openId !== message.conversation
    const known = get().conversations.some((row) => row.id === message.conversation)

    set((state) => ({
      threads: withMessage(state.threads, message),
      conversations: promote(state.conversations, message, counts ? 1 : 0),
      unread: counts ? state.unread + 1 : state.unread,
      // Sending is the end of typing, whether or not a "stop" follows.
      typing: without(state.typing, message.conversation),
    }))

    if (!known) {
      // A first message from someone the inbox has never seen.
      void get().loadInbox()
    } else if (!counts && !mine) {
      void get().markRead(message.conversation)
    }
  },

  setTransport: (send) => {
    transport = send
  },

  setConnected: (connected) => set({ connected }),

  reset: () => {
    ;[...idleTimers.values(), ...expiryTimers.values()].forEach(clearTimeout)
    idleTimers.clear()
    expiryTimers.clear()
    typingSentAt.clear()
    set({ ...INITIAL })
  },
}))

type Setter = (partial: (state: ChatState) => Partial<ChatState>) => void

function patchThread(set: Setter, conversationId: string, changes: Partial<ThreadState>): void {
  set((state) => ({
    threads: {
      ...state.threads,
      [conversationId]: { ...(state.threads[conversationId] ?? EMPTY_THREAD), ...changes },
    },
  }))
}

/** Adds a message to a thread that is loaded, ignoring one already held. */
function withMessage(
  threads: Record<string, ThreadState>,
  message: ChatMessage,
): Record<string, ThreadState> {
  const thread = threads[message.conversation]
  if (!thread || thread.messages.some((existing) => existing.id === message.id)) return threads
  return {
    ...threads,
    [message.conversation]: { ...thread, messages: [message, ...thread.messages] },
  }
}

/** Moves a thread to the top of the inbox with its new preview line. */
function promote(
  conversations: Conversation[],
  message: ChatMessage,
  unreadDelta: number,
): Conversation[] {
  const target = conversations.find((row) => row.id === message.conversation)
  if (!target) return conversations

  const updated: Conversation = {
    ...target,
    last_message: message,
    last_message_at: message.created_at,
    unread_count: target.unread_count + unreadDelta,
  }
  return [updated, ...conversations.filter((row) => row.id !== target.id)]
}

function merge(current: Conversation[], incoming: Conversation[]): Conversation[] {
  const byId = new Map(current.map((row) => [row.id, row]))
  incoming.forEach((row) => byId.set(row.id, row))
  return [...byId.values()].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
}

function without(typing: Record<string, string>, conversationId: string): Record<string, string> {
  if (!(conversationId in typing)) return typing
  const { [conversationId]: _dropped, ...rest } = typing
  return rest
}

function dedupe(messages: ChatMessage[]): ChatMessage[] {
  return [...new Map(messages.map((message) => [message.id, message])).values()]
}
