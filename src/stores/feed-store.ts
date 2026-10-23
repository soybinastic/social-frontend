import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { postsApi } from '@/lib/api/posts'
import { toErrorMessage } from '@/lib/api/errors'
import type { Page, Post } from '@/types/api'

export const HOME_LIST = 'home'
export const userList = (username: string) => `user:${username}`
export const postList = (postId: string) => `post:${postId}`

interface ListState {
  ids: string[]
  next: string | null
  loading: boolean
  loadingMore: boolean
  error: string | null
}

const EMPTY_LIST: ListState = {
  ids: [],
  next: null,
  loading: true,
  loadingMore: false,
  error: null,
}

interface FeedState {
  /**
   * Posts are stored once and referenced by id from each list. A post can
   * appear in the home feed and a profile feed at the same time, and this way
   * liking it updates both without any cross-list bookkeeping.
   */
  postsById: Record<string, Post>
  lists: Record<string, ListState>

  loadList: (key: string, options?: { more?: boolean }) => Promise<void>
  addPost: (post: Post, key?: string) => void
  removePost: (postId: string) => Promise<void>
  setLiked: (postId: string, liked: boolean) => Promise<void>
  sharePost: (postId: string, caption: string) => Promise<Post>
  adjustCommentCount: (postId: string, delta: number) => void
}

/** Chooses the endpoint a list key refers to. */
function fetcherFor(key: string): (cursor?: string | null) => Promise<Page<Post>> {
  if (key === HOME_LIST) {
    return (cursor) => postsApi.feed(cursor)
  }
  if (key.startsWith('post:')) {
    // A single post borrows the list machinery so its card's like, share and
    // delete actions behave exactly as they do in a feed.
    const postId = key.slice('post:'.length)
    return async () => ({ next: null, previous: null, results: [await postsApi.byId(postId)] })
  }
  const username = key.slice('user:'.length)
  return (cursor) => postsApi.byUser(username, cursor)
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  postsById: {},
  lists: {},

  loadList: async (key, options) => {
    const more = options?.more ?? false
    const existing = get().lists[key]

    if (more && (!existing?.next || existing.loadingMore)) return

    patchList(set, key, more ? { loadingMore: true } : { loading: true, error: null })

    try {
      const page = await fetcherFor(key)(more ? existing?.next : null)
      const incoming = Object.fromEntries(page.results.map((post) => [post.id, post]))
      const ids = page.results.map((post) => post.id)

      set((state) => ({
        postsById: { ...state.postsById, ...incoming },
        lists: {
          ...state.lists,
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
      patchList(set, key, {
        loading: false,
        loadingMore: false,
        error: toErrorMessage(error, 'Could not load posts.'),
      })
    }
  },

  addPost: (post, key = HOME_LIST) => {
    set((state) => {
      const list = state.lists[key] ?? EMPTY_LIST
      return {
        postsById: { ...state.postsById, [post.id]: post },
        lists: {
          ...state.lists,
          [key]: { ...list, ids: dedupe([post.id, ...list.ids]), loading: false },
        },
      }
    })
  },

  removePost: async (postId) => {
    const previous = get().postsById[postId]
    // Drop it immediately; the feed feels instant and the post is restored if
    // the request fails.
    set((state) => ({
      postsById: omit(state.postsById, postId),
      lists: mapLists(state.lists, (list) => ({
        ...list,
        ids: list.ids.filter((id) => id !== postId),
      })),
    }))

    try {
      await postsApi.remove(postId)
    } catch (error) {
      if (previous) get().addPost(previous)
      throw error
    }
  },

  setLiked: async (postId, liked) => {
    const current = get().postsById[postId]
    if (!current) return

    // Optimistic: reflect the tap now, reconcile with the server's counts after.
    patchPost(set, postId, {
      liked,
      like_count: Math.max(0, current.like_count + (liked ? 1 : -1)),
    })

    try {
      const state = liked ? await postsApi.like(postId) : await postsApi.unlike(postId)
      patchPost(set, postId, {
        liked: state.liked,
        like_count: state.like_count,
        share_count: state.share_count,
      })
    } catch (error) {
      patchPost(set, postId, { liked: current.liked, like_count: current.like_count })
      throw error
    }
  },

  sharePost: async (postId, caption) => {
    const share = await postsApi.share(postId, caption)
    get().addPost(share)
    // The original's share_count is returned already incremented on the copy
    // embedded in the new post.
    if (share.shared_from) {
      patchPost(set, share.shared_from.id, { share_count: share.shared_from.share_count + 1 })
    }
    return share
  },

  /**
   * Called by the comment store, which owns the comments themselves but not the
   * count beside the button that opens them.
   */
  adjustCommentCount: (postId, delta) => {
    const post = get().postsById[postId]
    if (!post) return
    patchPost(set, postId, { comment_count: Math.max(0, post.comment_count + delta) })
  },
}))

/** Reads one list plus its resolved posts. */
export function usePostList(key: string) {
  const list = useFeedStore(useShallow((state) => state.lists[key] ?? EMPTY_LIST))
  const postsById = useFeedStore((state) => state.postsById)

  const posts = useMemo(
    () => list.ids.map((id) => postsById[id]).filter((post): post is Post => Boolean(post)),
    [list.ids, postsById],
  )

  return { ...list, posts }
}

type Setter = (updater: (state: FeedState) => Partial<FeedState>) => void

function patchList(set: Setter, key: string, changes: Partial<ListState>): void {
  set((state) => ({
    lists: { ...state.lists, [key]: { ...(state.lists[key] ?? EMPTY_LIST), ...changes } },
  }))
}

function patchPost(set: Setter, postId: string, changes: Partial<Post>): void {
  set((state) => {
    const post = state.postsById[postId]
    if (!post) return {}
    return { postsById: { ...state.postsById, [postId]: { ...post, ...changes } } }
  })
}

function mapLists(
  lists: Record<string, ListState>,
  fn: (list: ListState) => ListState,
): Record<string, ListState> {
  return Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, fn(list)]))
}

function omit(posts: Record<string, Post>, postId: string): Record<string, Post> {
  const { [postId]: _removed, ...rest } = posts
  return rest
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)]
}
