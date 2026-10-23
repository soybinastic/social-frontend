import {
  BellOff,
  CheckCheck,
  Heart,
  Loader2,
  MessageCircle,
  Reply,
  Repeat2,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { UserAvatar } from '@/components/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { toErrorMessage } from '@/lib/api/errors'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notification-store'
import type { Notification, NotificationKind } from '@/types/api'

/** How each kind reads, looks, and where it goes when clicked. */
const KINDS: Record<NotificationKind, { text: string; icon: LucideIcon; tint: string }> = {
  follow: { text: 'started following you', icon: UserPlus, tint: 'text-primary' },
  like: { text: 'liked your post', icon: Heart, tint: 'text-rose-600' },
  share: { text: 'shared your post', icon: Repeat2, tint: 'text-emerald-600' },
  comment: { text: 'commented on your post', icon: MessageCircle, tint: 'text-primary' },
  reply: { text: 'replied to your comment', icon: Reply, tint: 'text-primary' },
  comment_like: { text: 'liked your comment', icon: Heart, tint: 'text-rose-600' },
}

function destinationOf(notification: Notification): string {
  if (notification.post) return `/p/${notification.post.id}`
  return `/u/${notification.actor.username}`
}

/**
 * What the row quotes underneath: the comment when it is about one, and the post
 * otherwise. A comment is the more specific of the two, and the reason for the
 * notification.
 */
function previewOf(notification: Notification): string | null {
  return notification.comment?.body ?? notification.post?.caption ?? null
}

function NotificationRow({ notification }: { notification: Notification }) {
  const markRead = useNotificationStore((state) => state.markRead)
  const navigate = useNavigate()
  const { text, icon: Icon, tint } = KINDS[notification.kind]

  function open() {
    void markRead(notification.id)
    navigate(destinationOf(notification))
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/50',
        !notification.is_read && 'bg-primary/5',
      )}
    >
      <div className="relative shrink-0">
        <UserAvatar user={notification.actor} />
        <span className="absolute -right-1 -bottom-1 rounded-full border bg-background p-1">
          <Icon className={cn('size-3', tint)} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{notification.actor.name}</span> {text}
        </p>
        {previewOf(notification) && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {previewOf(notification)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relativeTime(notification.created_at)}
        </p>
      </div>

      {!notification.is_read && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
      )}
    </button>
  )
}

export function NotificationsPage() {
  const { items, next, unread, loading, loadingMore, error } = useNotificationStore()
  const load = useNotificationStore((state) => state.load)
  const refreshUnread = useNotificationStore((state) => state.refreshUnread)
  const markAllRead = useNotificationStore((state) => state.markAllRead)

  useEffect(() => {
    void load()
    void refreshUnread()
  }, [load, refreshUnread])

  const sentinelRef = useInfiniteScroll(
    () => void load({ more: true }),
    Boolean(next) && !loadingMore,
  )

  async function readAll() {
    try {
      await markAllRead()
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Could not mark these as read.'))
    }
  }

  function body() {
    if (error && items.length === 0) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Could not load notifications</AlertTitle>
          <AlertDescription className="flex-col items-start gap-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (loading && items.length === 0) {
      return (
        <Card className="gap-0 divide-y py-0">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </Card>
      )
    }

    if (items.length === 0) {
      return (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <BellOff className="size-8 text-muted-foreground" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            Follows, likes, comments and shares of your posts will show up here.
          </p>
        </Card>
      )
    }

    return (
      <Card className="gap-0 divide-y py-0">
        {items.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        ))}
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Notifications</h1>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void readAll()}>
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {body()}
    </div>
  )
}
