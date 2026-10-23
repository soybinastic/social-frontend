import { Check, CheckCheck, Reply } from 'lucide-react'

import { Attachment } from '@/components/media/attachments'
import { UserAvatar } from '@/components/user-avatar'
import { summarizeMessage } from '@/lib/chat'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/api'

export type MessageStatus = 'sent' | 'seen'

interface MessageBubbleProps {
  message: ChatMessage
  mine: boolean
  /** Shown on your latest message only, where it is the thread's own status. */
  status?: MessageStatus
  onReply: (message: ChatMessage) => void
}

export function MessageBubble({ message, mine, status, onReply }: MessageBubbleProps) {
  const hasBubble = Boolean(message.body || message.reply_to)

  return (
    <div className={cn('flex items-end gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
      {/* Only the other side is identified; you know which messages are yours. */}
      {mine ? <span className="w-8 shrink-0" /> : <UserAvatar user={message.sender} className="size-8" />}

      <div className={cn('flex min-w-0 max-w-[78%] flex-col gap-1', mine && 'items-end')}>
        {hasBubble && (
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-sm',
              mine
                ? 'rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-bl-sm bg-muted',
            )}
          >
            {message.reply_to && (
              <div
                className={cn(
                  'mb-1.5 border-l-2 pl-2 text-xs',
                  mine
                    ? 'border-primary-foreground/40 text-primary-foreground/80'
                    : 'border-primary/50 text-muted-foreground',
                )}
              >
                <p className="font-medium">{message.reply_to.sender.name}</p>
                <p className="line-clamp-2 break-words">{summarizeMessage(message.reply_to)}</p>
              </div>
            )}
            {message.body && <p className="break-words whitespace-pre-wrap">{message.body}</p>}
          </div>
        )}

        {/* Attachments sit outside the bubble so their own controls stay legible. */}
        {message.media.length > 0 && (
          <div
            className={cn(
              'grid w-full gap-2',
              message.media.length > 1 && message.media.every((asset) => asset.kind === 'image')
                ? 'grid-cols-2'
                : 'grid-cols-1',
            )}
          >
            {message.media.map((asset, index) => (
              <Attachment key={`${asset.url}-${index}`} asset={asset} className="max-h-60" />
            ))}
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-2 text-[0.6875rem] text-muted-foreground',
            mine && 'flex-row-reverse',
          )}
        >
          <span>{relativeTime(message.created_at)}</span>
          {status && (
            <span className={cn('flex items-center gap-1', status === 'seen' && 'text-primary')}>
              {status === 'seen' ? <CheckCheck className="size-3" /> : <Check className="size-3" />}
              {status === 'seen' ? 'Seen' : 'Sent'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onReply(message)}
            // Always shown rather than revealed on hover, which a touch screen
            // has no way to do.
            className="flex items-center gap-1 transition hover:text-foreground"
          >
            <Reply className="size-3" />
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}
