import { Loader2, MessagesSquare } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { UserAvatar } from '@/components/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { summarizeMessage } from '@/lib/chat'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import type { Conversation } from '@/types/api'

function preview(conversation: Conversation, viewerId: string | undefined): string {
  const last = conversation.last_message
  if (!last) return 'No messages yet'
  return `${last.sender.id === viewerId ? 'You: ' : ''}${summarizeMessage(last)}`
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const viewerId = useAuthStore((state) => state.user?.id)
  const typing = useChatStore((state) => Boolean(state.typing[conversation.id]))
  const unread = conversation.unread_count > 0

  return (
    <Link
      to={`/messages/${conversation.id}`}
      className={cn(
        'flex items-center gap-3 p-4 transition hover:bg-muted/50',
        unread && 'bg-primary/5',
      )}
    >
      <UserAvatar user={conversation.other} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold">{conversation.other.name}</p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(conversation.last_message_at)}
          </span>
        </div>
        {typing ? (
          <p className="truncate text-sm font-medium text-primary">typing…</p>
        ) : (
          <p
            className={cn(
              'truncate text-sm text-muted-foreground',
              unread && 'font-medium text-foreground',
            )}
          >
            {preview(conversation, viewerId)}
          </p>
        )}
      </div>

      {unread && (
        <Badge className="h-5 min-w-5 shrink-0 justify-center px-1.5 tabular-nums">
          {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
        </Badge>
      )}
    </Link>
  )
}

export function MessagesPage() {
  const { conversations, next, loadingInbox, loadingMoreInbox, inboxError } = useChatStore()
  const loadInbox = useChatStore((state) => state.loadInbox)

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const sentinelRef = useInfiniteScroll(
    () => void loadInbox({ more: true }),
    Boolean(next) && !loadingMoreInbox,
  )

  function body() {
    if (inboxError && conversations.length === 0) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Could not load messages</AlertTitle>
          <AlertDescription className="flex-col items-start gap-2">
            <span>{inboxError}</span>
            <Button variant="outline" size="sm" onClick={() => void loadInbox()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (loadingInbox && conversations.length === 0) {
      return (
        <Card className="gap-0 divide-y py-0">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </Card>
      )
    }

    if (conversations.length === 0) {
      return (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <MessagesSquare className="size-8 text-muted-foreground" />
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm text-muted-foreground">
            Open someone's profile and choose Message to start one.
          </p>
        </Card>
      )
    }

    return (
      <Card className="gap-0 divide-y py-0">
        {conversations.map((conversation) => (
          <ConversationRow key={conversation.id} conversation={conversation} />
        ))}
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMoreInbox && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Messages</h1>
      {body()}
    </div>
  )
}
