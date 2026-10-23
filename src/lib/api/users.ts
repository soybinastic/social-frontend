import { apiClient } from '@/lib/api/client'
import type { FollowState, Page, Profile } from '@/types/api'

export const usersApi = {
  async profile(username: string): Promise<Profile> {
    const { data } = await apiClient.get<Profile>(`/users/${username}/`)
    return data
  },

  async follow(username: string): Promise<FollowState> {
    const { data } = await apiClient.post<FollowState>(`/users/${username}/follow/`)
    return data
  },

  async unfollow(username: string): Promise<FollowState> {
    const { data } = await apiClient.delete<FollowState>(`/users/${username}/follow/`)
    return data
  },

  async followers(username: string, cursorUrl?: string | null): Promise<Page<Profile>> {
    // `next` from the API is an absolute URL, so it is requested as-is.
    const { data } = cursorUrl
      ? await apiClient.get<Page<Profile>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Profile>>(`/users/${username}/followers/`)
    return data
  },

  async following(username: string, cursorUrl?: string | null): Promise<Page<Profile>> {
    const { data } = cursorUrl
      ? await apiClient.get<Page<Profile>>(cursorUrl, { baseURL: undefined })
      : await apiClient.get<Page<Profile>>(`/users/${username}/following/`)
    return data
  },
}
