import { apiClient } from '@/lib/api/client'
import type { InteractionState, Page, Post, User } from '@/types/api'

export const postsApi = {
  async feed(cursorUrl?: string | null): Promise<Page<Post>> {
    // `next` from the API is an absolute URL, so it is requested as-is.
    const { data } = cursorUrl
      ? await apiClient.get<Page<Post>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Post>>('/posts/')
    return data
  },

  async byId(postId: string): Promise<Post> {
    const { data } = await apiClient.get<Post>(`/posts/${postId}/`)
    return data
  },

  async byUser(username: string, cursorUrl?: string | null): Promise<Page<Post>> {
    const { data } = cursorUrl
      ? await apiClient.get<Page<Post>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Post>>(`/users/${username}/posts/`)
    return data
  },

  async create(input: { caption: string; files: File[] }): Promise<Post> {
    const form = new FormData()
    form.append('caption', input.caption)
    // Repeated parts under one key; the view reads them with getlist('files').
    input.files.forEach((file) => form.append('files', file))

    const { data } = await apiClient.post<Post>('/posts/', form)
    return data
  },

  async remove(postId: string): Promise<void> {
    await apiClient.delete(`/posts/${postId}/`)
  },

  async like(postId: string): Promise<InteractionState> {
    const { data } = await apiClient.post<InteractionState>(`/posts/${postId}/like/`)
    return data
  },

  async unlike(postId: string): Promise<InteractionState> {
    const { data } = await apiClient.delete<InteractionState>(`/posts/${postId}/like/`)
    return data
  },

  async likers(postId: string): Promise<Page<User>> {
    const { data } = await apiClient.get<Page<User>>(`/posts/${postId}/likers/`)
    return data
  },

  async share(postId: string, caption: string): Promise<Post> {
    const { data } = await apiClient.post<Post>(`/posts/${postId}/share/`, { caption })
    return data
  },
}
