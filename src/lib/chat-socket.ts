import type { ChatCommand, ChatEvent } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

/**
 * `ws://host/ws/chat/` derived from the REST base URL, so one environment
 * variable configures both and they cannot drift apart.
 */
function deriveSocketUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/chat/'
  url.search = ''
  return url.toString()
}

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? deriveSocketUrl(API_BASE_URL)

/** Backoff between reconnects, so a server restart is not a stampede. */
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000]

/** An idle socket is liable to be dropped by proxies, so it is kept warm. */
const KEEPALIVE_MS = 30_000

export type ChatSocketStatus = 'connecting' | 'open' | 'closed'

interface ChatSocketOptions {
  /** Read at connect time rather than captured, so a refreshed token is used. */
  getToken: () => string | null
  onEvent: (event: ChatEvent) => void
  onStatus?: (status: ChatSocketStatus) => void
}

export interface ChatSocket {
  /**
   * Sends a command, or drops it while the socket is down.
   *
   * Nothing sent this way is worth queueing: a keepalive has no meaning later,
   * and neither does "still typing".
   */
  send: (command: ChatCommand) => void
  close: () => void
}

/**
 * Keeps a chat socket open for as long as the caller wants one.
 *
 * Reconnecting is unconditional — including after the server rejects the token,
 * since the REST client refreshes tokens on its own and the next attempt picks
 * the new one up.
 */
export function openChatSocket({ getToken, onEvent, onStatus }: ChatSocketOptions): ChatSocket {
  let socket: WebSocket | null = null
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let keepaliveTimer: ReturnType<typeof setInterval> | undefined
  let stopped = false

  function send(command: ChatCommand) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(command))
    }
  }

  function scheduleRetry() {
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
    attempt += 1
    retryTimer = setTimeout(connect, delay)
  }

  function connect() {
    if (stopped) return

    const token = getToken()
    if (!token) {
      scheduleRetry()
      return
    }

    onStatus?.('connecting')
    socket = new WebSocket(`${SOCKET_URL}?token=${encodeURIComponent(token)}`)

    socket.onopen = () => {
      attempt = 0
      onStatus?.('open')
      keepaliveTimer = setInterval(() => send({ type: 'ping' }), KEEPALIVE_MS)
    }

    socket.onmessage = (raw) => {
      try {
        onEvent(JSON.parse(raw.data as string) as ChatEvent)
      } catch {
        // A frame we cannot parse is a frame we do not need.
      }
    }

    socket.onclose = () => {
      clearInterval(keepaliveTimer)
      if (stopped) return
      onStatus?.('closed')
      scheduleRetry()
    }
  }

  connect()

  return {
    send,
    close: () => {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(keepaliveTimer)
      socket?.close()
    },
  }
}
