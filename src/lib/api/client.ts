import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export const apiClient = axios.create({ baseURL: API_BASE_URL })

/**
 * How the client reaches session state.
 *
 * The client is handed these rather than importing the store, which keeps the
 * two modules free of a circular dependency and makes the client testable with
 * plain stubs.
 */
export interface SessionBridge {
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  onTokensRefreshed: (tokens: { access: string; refresh?: string }) => void
  onSessionExpired: () => void
}

let bridge: SessionBridge | null = null

/** Single in-flight refresh, so a burst of 401s triggers only one round trip. */
let refreshInFlight: Promise<string> | null = null

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

export function configureApiSession(next: SessionBridge): void {
  bridge = next
}

apiClient.interceptors.request.use((config) => {
  const token = bridge?.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

async function refreshAccessToken(): Promise<string> {
  const refresh = bridge?.getRefreshToken()
  if (!refresh) {
    throw new Error('No refresh token available')
  }

  // A bare axios call avoids re-entering this interceptor.
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_BASE_URL}/auth/refresh/`,
    { refresh },
  )
  bridge?.onTokensRefreshed(data)
  return data.access
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const isExpiredToken = error.response?.status === 401 && config && !config._retried

    if (!isExpiredToken || !bridge?.getRefreshToken()) {
      return Promise.reject(error)
    }

    config._retried = true
    try {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null
      })
      const access = await refreshInFlight
      config.headers.Authorization = `Bearer ${access}`
      return apiClient.request(config as AxiosRequestConfig)
    } catch {
      bridge.onSessionExpired()
      return Promise.reject(error)
    }
  },
)
