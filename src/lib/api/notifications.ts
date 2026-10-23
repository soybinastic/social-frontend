import { apiClient } from '@/lib/api/client'
import type { Notification, Page } from '@/types/api'

export const notificationsApi = {
  async list(cursorUrl?: string | null): Promise<Page<Notification>> {
    // `next` from the API is an absolute URL, so it is requested as-is.
    const { data } = cursorUrl
      ? await apiClient.get<Page<Notification>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Notification>>('/notifications/')
    return data
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ unread: number }>('/notifications/unread-count/')
    return data.unread
  },

  async markRead(notificationId: string): Promise<Notification> {
    const { data } = await apiClient.post<Notification>(
      `/notifications/${notificationId}/read/`,
    )
    return data
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all/')
  },
}
