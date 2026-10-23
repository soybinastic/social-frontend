import { configureApiSession } from '@/lib/api/client'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Connects the HTTP client to the auth store.
 *
 * Injecting the accessors here, instead of having the client import the store,
 * keeps the dependency pointing one way and leaves the client usable in tests
 * without any store at all.
 */
export function installApiSessionBridge(): void {
  configureApiSession({
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onTokensRefreshed: (tokens) => useAuthStore.getState().applyRefreshedTokens(tokens),
    onSessionExpired: () => useAuthStore.getState().logout(),
  })
}
