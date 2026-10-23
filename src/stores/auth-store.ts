import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { authApi, type LoginPayload, type RegisterPayload } from '@/lib/api/auth'
import type { Session, User } from '@/types/api'

/**
 * `hydrating` covers the gap between page load and confirming the persisted
 * token still works, so the router can avoid bouncing a signed-in user to the
 * login screen on refresh.
 */
type AuthStatus = 'hydrating' | 'authenticated' | 'anonymous'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  status: AuthStatus

  register: (payload: RegisterPayload) => Promise<void>
  login: (payload: LoginPayload) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
  setUser: (user: User) => void
  applyRefreshedTokens: (tokens: { access: string; refresh?: string }) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'hydrating',

      register: async (payload) => {
        adopt(set, await authApi.register(payload))
      },

      login: async (payload) => {
        adopt(set, await authApi.login(payload))
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, status: 'anonymous' })
      },

      hydrate: async () => {
        if (!get().accessToken) {
          set({ status: 'anonymous' })
          return
        }
        try {
          // Also refreshes the cached profile, which may be stale from a
          // previous session.
          set({ user: await authApi.currentUser(), status: 'authenticated' })
        } catch {
          set({ user: null, accessToken: null, refreshToken: null, status: 'anonymous' })
        }
      },

      setUser: (user) => set({ user }),

      applyRefreshedTokens: ({ access, refresh }) =>
        set((state) => ({
          accessToken: access,
          refreshToken: refresh ?? state.refreshToken,
        })),
    }),
    {
      name: 'social-media-auth',
      // Only durable identity is persisted; `status` is recomputed each load.
      partialize: ({ user, accessToken, refreshToken }) => ({ user, accessToken, refreshToken }),
    },
  ),
)

function adopt(set: (partial: Partial<AuthState>) => void, session: Session): void {
  set({
    user: session.user,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    status: 'authenticated',
  })
}
