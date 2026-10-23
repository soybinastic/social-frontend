import { create } from 'zustand'

import { notificationsApi } from '@/lib/api/notifications'
import { toErrorMessage } from '@/lib/api/errors'
import type { Notification } from '@/types/api'

interface NotificationState {
  items: Notification[]
  next: string | null
  /** Drives the header badge, which is why it is kept outside the list. */
  unread: number
  loading: boolean
  loadingMore: boolean
  error: string | null

  load: (options?: { more?: boolean }) => Promise<void>
  refreshUnread: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  next: null,
  unread: 0,
  loading: true,
  loadingMore: false,
  error: null,

  load: async (options) => {
    const more = options?.more ?? false
    const { next, loadingMore } = get()

    if (more && (!next || loadingMore)) return
    set(more ? { loadingMore: true } : { loading: true, error: null })

    try {
      const page = await notificationsApi.list(more ? next : null)
      set((state) => ({
        items: more ? [...state.items, ...page.results] : page.results,
        next: page.next,
        loading: false,
        loadingMore: false,
        error: null,
      }))
    } catch (error) {
      set({
        loading: false,
        loadingMore: false,
        error: toErrorMessage(error, 'Could not load your notifications.'),
      })
    }
  },

  refreshUnread: async () => {
    try {
      set({ unread: await notificationsApi.unreadCount() })
    } catch {
      // A stale badge is not worth interrupting anyone over.
    }
  },

  markRead: async (notificationId) => {
    const target = get().items.find((item) => item.id === notificationId)
    if (!target || target.is_read) return

    // Optimistic: the row is usually being clicked on its way to somewhere else.
    set((state) => ({
      items: state.items.map((item) =>
        item.id === notificationId ? { ...item, is_read: true } : item,
      ),
      unread: Math.max(0, state.unread - 1),
    }))

    try {
      await notificationsApi.markRead(notificationId)
    } catch {
      set((state) => ({
        items: state.items.map((item) =>
          item.id === notificationId ? { ...item, is_read: false } : item,
        ),
        unread: state.unread + 1,
      }))
    }
  },

  markAllRead: async () => {
    const previous = get().items
    set((state) => ({
      items: state.items.map((item) => ({ ...item, is_read: true })),
      unread: 0,
    }))

    try {
      await notificationsApi.markAllRead()
    } catch (error) {
      set({ items: previous })
      await get().refreshUnread()
      throw error
    }
  },
}))
