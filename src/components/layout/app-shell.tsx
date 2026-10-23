import { Bell, Home, LogOut, MessageCircle, Sparkles, User as UserIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { openChatSocket } from '@/lib/chat-socket'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import { useNotificationStore } from '@/stores/notification-store'

/** How often the badges re-check for news. */
const UNREAD_POLL_MS = 45_000

export function AppShell() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const unread = useNotificationStore((state) => state.unread)
  const refreshUnread = useNotificationStore((state) => state.refreshUnread)
  const chatUnread = useChatStore((state) => state.unread)
  const refreshChatUnread = useChatStore((state) => state.refreshUnread)
  const applyChatEvent = useChatStore((state) => state.applyEvent)
  const setChatTransport = useChatStore((state) => state.setTransport)
  const setChatConnected = useChatStore((state) => state.setConnected)
  const resetChat = useChatStore((state) => state.reset)
  const navigate = useNavigate()

  // Notifications have no socket, and chat's may be down, so both badges are
  // polled as a floor on how stale they can get.
  useEffect(() => {
    const refreshBadges = () => {
      void refreshUnread()
      void refreshChatUnread()
    }
    refreshBadges()
    const timer = setInterval(refreshBadges, UNREAD_POLL_MS)
    return () => clearInterval(timer)
  }, [refreshUnread, refreshChatUnread])

  // One socket for the whole session, so chat is live on every page and the
  // badge updates for threads that are not open.
  const viewerId = user?.id
  useEffect(() => {
    if (!viewerId) return

    const socket = openChatSocket({
      // Read late rather than captured, so a refreshed token is used.
      getToken: () => useAuthStore.getState().accessToken,
      onEvent: (event) => applyChatEvent(event, viewerId),
      onStatus: (status) => setChatConnected(status === 'open'),
    })
    // How the composer reaches the socket without being handed it down the tree.
    setChatTransport(socket.send)

    return () => {
      socket.close()
      setChatTransport(null)
      setChatConnected(false)
      // Nothing from this account's inbox should survive into another's.
      resetChat()
    }
  }, [viewerId, applyChatEvent, setChatTransport, setChatConnected, resetChat])

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-5 text-primary" />
            Social Media
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end>
              {({ isActive }) => (
                <Button variant="ghost" size="sm" className={cn(isActive && 'text-primary')}>
                  <Home className="size-4" />
                  <span className="sr-only sm:not-sr-only">Feed</span>
                </Button>
              )}
            </NavLink>

            <NavLink to="/messages">
              {({ isActive }) => (
                <Button variant="ghost" size="sm" className={cn(isActive && 'text-primary')}>
                  <MessageCircle className="size-4" />
                  <span className="sr-only sm:not-sr-only">Chats</span>
                  {chatUnread > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[0.625rem] tabular-nums">
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </Badge>
                  )}
                </Button>
              )}
            </NavLink>

            <NavLink to="/notifications">
              {({ isActive }) => (
                <Button variant="ghost" size="sm" className={cn(isActive && 'text-primary')}>
                  <Bell className="size-4" />
                  <span className="sr-only sm:not-sr-only">Alerts</span>
                  {unread > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[0.625rem] tabular-nums">
                      {unread > 9 ? '9+' : unread}
                    </Badge>
                  )}
                </Button>
              )}
            </NavLink>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="ml-1 rounded-full" aria-label="Account menu">
                    <UserAvatar user={user} className="size-8" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">
                    <span className="block truncate">{user.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      @{user.username}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/u/${user.username}`)}>
                    <UserIcon className="size-4" />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={signOut}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
