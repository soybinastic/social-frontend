import { apiClient } from '@/lib/api/client'
import type { Session, User } from '@/types/api'

export interface RegisterPayload {
  email: string
  username: string
  password: string
  display_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<Session> {
    const { data } = await apiClient.post<Session>('/auth/register/', payload)
    return data
  },

  async login(payload: LoginPayload): Promise<Session> {
    const { data } = await apiClient.post<Session>('/auth/login/', payload)
    return data
  },

  async currentUser(): Promise<User> {
    const { data } = await apiClient.get<User>('/users/me/')
    return data
  },

  async updateProfile(payload: { display_name?: string; bio?: string }): Promise<User> {
    const { data } = await apiClient.patch<User>('/users/me/', payload)
    return data
  },

  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.put<User>('/users/me/avatar/', form)
    return data
  },
}
