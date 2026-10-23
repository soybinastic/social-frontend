import { apiClient } from '@/lib/api/client'
import type { ChatMessage, Conversation, Page } from '@/types/api'

export interface MessageDraft {
  body: string
  files: File[]
  /** The message being replied to, if any. */
  replyTo: string | null
}

export const chatApi = {
  async conversations(cursorUrl?: string | null): Promise<Page<Conversation>> {
    // `next` from the API is an absolute URL, so it is requested as-is.
    const { data } = cursorUrl
      ? await apiClient.get<Page<Conversation>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Conversation>>('/conversations/')
    return data
  },

  async conversation(conversationId: string): Promise<Conversation> {
    const { data } = await apiClient.get<Conversation>(`/conversations/${conversationId}/`)
    return data
  },

  /** Opens the thread with someone, which the server creates only once. */
  async startWith(username: string): Promise<Conversation> {
    const { data } = await apiClient.post<Conversation>('/conversations/', { username })
    return data
  },

  async messages(conversationId: string, cursorUrl?: string | null): Promise<Page<ChatMessage>> {
    const { data } = cursorUrl
      ? await apiClient.get<Page<ChatMessage>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<ChatMessage>>(`/conversations/${conversationId}/messages/`)
    return data
  },

  async send(conversationId: string, draft: MessageDraft): Promise<ChatMessage> {
    const form = new FormData()
    form.append('body', draft.body)
    if (draft.replyTo) form.append('reply_to', draft.replyTo)
    // Repeated parts under one key; the view reads them with getlist('files').
    draft.files.forEach((file) => form.append('files', file))

    const { data } = await apiClient.post<ChatMessage>(
      `/conversations/${conversationId}/messages/`,
      form,
    )
    return data
  },

  /** Returns the viewer's remaining unread total across every thread. */
  async markRead(conversationId: string): Promise<number> {
    const { data } = await apiClient.post<{ unread: number }>(
      `/conversations/${conversationId}/read/`,
    )
    return data.unread
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ unread: number }>('/conversations/unread-count/')
    return data.unread
  },
}
