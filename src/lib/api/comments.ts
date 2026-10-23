import { apiClient } from '@/lib/api/client'
import type { Comment, CommentState, Page } from '@/types/api'

async function page(url: string, cursorUrl?: string | null): Promise<Page<Comment>> {
  // `next` from the API is an absolute URL, so it is requested as-is.
  const { data } = cursorUrl
    ? await apiClient.get<Page<Comment>>(cursorUrl, { baseURL: undefined })
    : await apiClient.get<Page<Comment>>(url)
  return data
}

export const commentsApi = {
  onPost(postId: string, cursorUrl?: string | null): Promise<Page<Comment>> {
    return page(`/posts/${postId}/comments/`, cursorUrl)
  },

  repliesTo(commentId: string, cursorUrl?: string | null): Promise<Page<Comment>> {
    return page(`/comments/${commentId}/replies/`, cursorUrl)
  },

  async add(postId: string, body: string): Promise<Comment> {
    const { data } = await apiClient.post<Comment>(`/posts/${postId}/comments/`, { body })
    return data
  },

  /** The post is derived from the parent, so a reply cannot land elsewhere. */
  async reply(commentId: string, body: string): Promise<Comment> {
    const { data } = await apiClient.post<Comment>(`/comments/${commentId}/replies/`, { body })
    return data
  },

  async like(commentId: string): Promise<CommentState> {
    const { data } = await apiClient.post<CommentState>(`/comments/${commentId}/like/`)
    return data
  },

  async unlike(commentId: string): Promise<CommentState> {
    const { data } = await apiClient.delete<CommentState>(`/comments/${commentId}/like/`)
    return data
  },

  async remove(commentId: string): Promise<void> {
    await apiClient.delete(`/comments/${commentId}/`)
  },
}
