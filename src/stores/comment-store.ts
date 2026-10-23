import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { commentsApi } from '@/lib/api/comments'
import { toErrorMessage } from '@/lib/api/errors'
import { useFeedStore } from '@/stores/feed-store'
import type { Comment, Page } from '@/types/api'

/** The conversation under a post: top-level comments only. */
export const postThread = (postId: string) => `post:${postId}`
/** The replies under one comment, fetched only once somebody asks for them. */
export const replyThread = (commentId: string) => `replies:${commentId}`

interface ThreadState {
  ids: string[]
  next: string | null
  loading: boolean
  loadingMore: boolean
  error: string | null
}

const EMPTY_THREAD: ThreadState = {
  ids: [],
  next: null,
  loading: true,
  loadingMore: false,
  error: null,
}

interface CommentStoreState {
  /**
   * Comments are stored once and referenced by id from each thread, the same way
   * the feed store holds posts: liking one updates it wherever it is on screen.
   */
  commentsById: Record<string, Comment>
  threads: Record<string, ThreadState>

  loadThread: (key: string, options?: { more?: boolean }) => Promise<void>
  add: (postId: string, body: string) => Promise<Comment>
  reply: (commentId: string, body: string) => Promise<Comment>
  setLiked: (commentId: string, liked: boolean) => Promise<void>
  remove: (commentId: string) => Promise<void>
}

/** Chooses the endpoint a thread key refers to. */
function fetcherFor(key: string): (cursor?: string | null) => Promise<Page<Comment>> {
  if (key.startsWith('replies:')) {
    const commentId = key.slice('replies:'.length)
    return (cursor) => commentsApi.repliesTo(commentId, cursor)
  }
  const postId = key.slice('post:'.length)
  return (cursor) => commentsApi.onPost(postId, cursor)
}

export const useCommentStore = create<CommentStoreState>()((set, get) => ({
  commentsById: {},
  threads: {},

  loadThread: async (key, options) => {
    const more = options?.more ?? false
    const existing = get().threads[key]

    if (more && (!existing?.next || existing.loadingMore)) return

    patchThread(set, key, more ? { loadingMore: true } : { loading: true, error: null })

    try {
      const page = await fetcherFor(key)(more ? existing?.next : null)
      const incoming = Object.fromEntries(page.results.map((row) => [row.id, row]))
      const ids = page.results.map((row) => row.id)

      set((state) => ({
        commentsById: { ...state.commentsById, ...incoming },
        threads: {
          ...state.threads,
          [key]: {
            ids: more ? dedupe([...(existing?.ids ?? []), ...ids]) : ids,
            next: page.next,
            loading: false,
            loadingMore: false,
            error: null,
          },
        },
      }))
    } catch (error) {
      patchThread(set, key, {
        loading: false,
        loadingMore: false,
        error: toErrorMessage(error, 'Could not load comments.'),
      })
    }
  },

  add: async (postId, body) => {
    const comment = await commentsApi.add(postId, body)
    prepend(set, postThread(postId), comment)
    useFeedStore.getState().adjustCommentCount(postId, 1)
    return comment
  },

  reply: async (commentId, body) => {
    const reply = await commentsApi.reply(commentId, body)
    // The server decides which comment a reply belongs to, flattening a reply to
    // a reply, so the thread it joins is read off the response rather than
    // assumed to be the one that was answered.
    const parentId = reply.parent ?? reply.id
    prepend(set, replyThread(parentId), reply)
    patchComment(set, parentId, (parent) => ({ reply_count: parent.reply_count + 1 }))
    useFeedStore.getState().adjustCommentCount(reply.post, 1)
    return reply
  },

  setLiked: async (commentId, liked) => {
    const current = get().commentsById[commentId]
    if (!current) return

    // Optimistic: reflect the tap now, reconcile with the server's count after.
    patchComment(set, commentId, () => ({
      liked,
      like_count: Math.max(0, current.like_count + (liked ? 1 : -1)),
    }))

    try {
      const state = liked
        ? await commentsApi.like(commentId)
        : await commentsApi.unlike(commentId)
      patchComment(set, commentId, () => state)
    } catch (error) {
      patchComment(set, commentId, () => ({
        liked: current.liked,
        like_count: current.like_count,
      }))
      throw error
    }
  },

  remove: async (commentId) => {
    const comment = get().commentsById[commentId]
    if (!comment) return

    await commentsApi.remove(commentId)

    // Deleting a comment takes its replies with it on the server, so the whole
    // sub-thread comes off the post's total here.
    const removed = 1 + (comment.parent ? 0 : comment.reply_count)
    const replies = get().threads[replyThread(commentId)]?.ids ?? []

    set((state) => ({
      commentsById: omit(state.commentsById, [commentId, ...replies]),
      threads: withoutIds(dropThread(state.threads, replyThread(commentId)), [
        commentId,
        ...replies,
      ]),
    }))

    if (comment.parent) {
      patchComment(set, comment.parent, (parent) => ({
        reply_count: Math.max(0, parent.reply_count - 1),
      }))
    }
    useFeedStore.getState().adjustCommentCount(comment.post, -removed)
  },
}))

/** Reads one thread plus its resolved comments. */
export function useCommentThread(key: string) {
  const thread = useCommentStore(useShallow((state) => state.threads[key] ?? EMPTY_THREAD))
  const commentsById = useCommentStore((state) => state.commentsById)

  const comments = useMemo(
    () => thread.ids.map((id) => commentsById[id]).filter((row): row is Comment => Boolean(row)),
    [thread.ids, commentsById],
  )

  return { ...thread, comments }
}

type Setter = (updater: (state: CommentStoreState) => Partial<CommentStoreState>) => void

function patchThread(set: Setter, key: string, changes: Partial<ThreadState>): void {
  set((state) => ({
    threads: { ...state.threads, [key]: { ...(state.threads[key] ?? EMPTY_THREAD), ...changes } },
  }))
}

function patchComment(
  set: Setter,
  commentId: string,
  changes: (comment: Comment) => Partial<Comment>,
): void {
  set((state) => {
    const comment = state.commentsById[commentId]
    if (!comment) return {}
    return {
      commentsById: { ...state.commentsById, [commentId]: { ...comment, ...changes(comment) } },
    }
  })
}

function prepend(set: Setter, key: string, comment: Comment): void {
  set((state) => {
    const thread = state.threads[key] ?? EMPTY_THREAD
    return {
      commentsById: { ...state.commentsById, [comment.id]: comment },
      threads: {
        ...state.threads,
        // `loading: false` matters for a thread nobody has opened yet: what it
        // holds now is one real comment, not a page still on its way.
        [key]: { ...thread, ids: dedupe([comment.id, ...thread.ids]), loading: false },
      },
    }
  })
}

function dropThread(
  threads: Record<string, ThreadState>,
  key: string,
): Record<string, ThreadState> {
  const { [key]: _removed, ...rest } = threads
  return rest
}

function withoutIds(
  threads: Record<string, ThreadState>,
  ids: string[],
): Record<string, ThreadState> {
  const gone = new Set(ids)
  return Object.fromEntries(
    Object.entries(threads).map(([key, thread]) => [
      key,
      { ...thread, ids: thread.ids.filter((id) => !gone.has(id)) },
    ]),
  )
}

function omit(comments: Record<string, Comment>, ids: string[]): Record<string, Comment> {
  const kept = { ...comments }
  ids.forEach((id) => delete kept[id])
  return kept
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)]
}
