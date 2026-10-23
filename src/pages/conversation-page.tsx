import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { MessageBubble, type MessageStatus } from '@/components/chat/message-bubble'
import { MessageComposer } from '@/components/chat/message-composer'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { UserAvatar } from '@/components/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import type { ChatMessage } from '@/types/api'

export function ConversationPage() {
  const { conversationId = '' } = useParams<{ conversationId: string }>()
  const viewerId = useAuthStore((state) => state.user?.id)

  const conversation = useChatStore((state) =>
    state.conversations.find((row) => row.id === conversationId),
  )
  const thread = useChatStore((state) => state.threads[conversationId])
  const typingUserId = useChatStore((state) => state.typing[conversationId])
  const connected = useChatStore((state) => state.connected)
  const loadConversation = useChatStore((state) => state.loadConversation)
  const loadThread = useChatStore((state) => state.loadThread)
  const markRead = useChatStore((state) => state.markRead)
  const openThread = useChatStore((state) => state.openThread)

  // Tagged with the thread it belongs to, so switching threads drops the reply
  // instead of the view resetting state from inside an effect.
  const [reply, setReply] = useState<{ conversationId: string; message: ChatMessage } | null>(null)
  const replyTo = reply?.conversationId === conversationId ? reply.message : null

  useEffect(() => {
    // While this thread is on screen, its incoming messages count as read.
    openThread(conversationId)
    void loadConversation(conversationId)
    void loadThread(conversationId)
    void markRead(conversationId)

    return () => openThread(null)
  }, [conversationId, loadConversation, loadThread, markRead, openThread])

  const sentinelRef = useInfiniteScroll(
    () => void loadThread(conversationId, { more: true }),
    Boolean(thread?.next) && !thread?.loadingMore,
  )

  const messages = thread?.messages ?? []

  /**
   * Status belongs to the thread rather than to each message, so it is shown on
   * your latest one only — a column of ticks says nothing extra.
   */
  const latestMine = messages.find((message) => message.sender.id === viewerId)
  function statusFor(message: ChatMessage): MessageStatus | undefined {
    if (message.id !== latestMine?.id) return undefined
    const readAt = conversation?.other_read_at
    const seen = readAt && Date.parse(readAt) >= Date.parse(message.created_at)
    return seen ? 'seen' : 'sent'
  }

  function history() {
    if (thread?.error && messages.length === 0) {
      return (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Could not load this conversation</AlertTitle>
          <AlertDescription className="flex-col items-start gap-2">
            <span>{thread.error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadThread(conversationId)}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (thread?.loading && messages.length === 0) {
      return (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className={row % 2 ? 'ml-auto h-10 w-2/5' : 'h-10 w-1/2'} />
          ))}
        </div>
      )
    }

    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <MessageCircle className="size-8 text-muted-foreground" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground">Say hello to start this conversation.</p>
        </div>
      )
    }

    return (
      <>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={message.sender.id === viewerId}
            status={statusFor(message)}
            onReply={(target) => setReply({ conversationId, message: target })}
          />
        ))}
        <div ref={sentinelRef} className="flex justify-center py-2">
          {thread?.loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="flex-row items-center gap-3 p-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to messages">
          <Link to="/messages">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        {conversation ? (
          <Link
            to={`/u/${conversation.other.username}`}
            className="flex min-w-0 items-center gap-3 hover:underline"
          >
            <UserAvatar user={conversation.other} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{conversation.other.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{conversation.other.username}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}

        {!connected && (
          <span className="ml-auto text-xs text-muted-foreground">Reconnecting…</span>
        )}
      </Card>

      {/*
        Reversed so the newest message sits at the bottom and the scroll position
        stays pinned there as messages arrive; older pages load upwards.
      */}
      <Card className="flex h-[60dvh] flex-col-reverse gap-3 overflow-y-auto p-4">
        {/* First in the reversed order, so it sits below the newest message. */}
        {typingUserId && conversation && <TypingIndicator user={conversation.other} />}
        {history()}
      </Card>

      <Card className="p-3">
        <MessageComposer
          conversationId={conversationId}
          replyTo={replyTo}
          onClearReply={() => setReply(null)}
        />
      </Card>
    </div>
  )
}
