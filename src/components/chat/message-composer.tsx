import { Image as ImageIcon, Loader2, Mic, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { summarizeMessage } from '@/lib/chat'
import { toErrorMessage } from '@/lib/api/errors'
import { formatBytes } from '@/lib/format'
import {
  CHAT_KINDS,
  MAX_MESSAGE_ATTACHMENTS,
  MEDIA_RULES,
  detectKind,
  validateFile,
} from '@/lib/media-kinds'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat-store'
import type { ChatMessage, MediaKind } from '@/types/api'

const BODY_LIMIT = 4000

interface PendingAttachment {
  id: string
  file: File
  kind: MediaKind
  /** Object URL for image thumbnails; revoked when the item is dropped. */
  previewUrl: string | null
}

const PICKERS: { kind: MediaKind; icon: typeof ImageIcon; label: string }[] = [
  { kind: 'image', icon: ImageIcon, label: 'Photo' },
  { kind: 'audio', icon: Mic, label: 'Audio' },
]

interface MessageComposerProps {
  conversationId: string
  replyTo: ChatMessage | null
  onClearReply: () => void
}

export function MessageComposer({ conversationId, replyTo, onClearReply }: MessageComposerProps) {
  const send = useChatStore((state) => state.send)
  const notifyTyping = useChatStore((state) => state.notifyTyping)

  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URLs are leaked memory until revoked, so release them on unmount.
  useEffect(
    () => () => {
      attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
    },
    [attachments],
  )

  // Leaving the thread, or switching to another, stops the indicator there.
  useEffect(
    () => () => notifyTyping(conversationId, false),
    [conversationId, notifyTyping],
  )

  const canSend = (body.trim().length > 0 || attachments.length > 0) && !sending

  function openPicker(kind: MediaKind) {
    // The accept attribute is set imperatively so one input serves both pickers.
    if (inputRef.current) {
      inputRef.current.accept = MEDIA_RULES[kind].accept
      inputRef.current.click()
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return

    const accepted: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (attachments.length + accepted.length >= MAX_MESSAGE_ATTACHMENTS) {
        toast.error(`A message can carry at most ${MAX_MESSAGE_ATTACHMENTS} attachments.`)
        break
      }
      const problem = validateFile(file, CHAT_KINDS)
      if (problem) {
        toast.error(problem)
        continue
      }
      const kind = detectKind(file) as MediaKind
      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        kind,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
      })
    }

    if (accepted.length > 0) setAttachments((current) => [...current, ...accepted])
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  async function submit() {
    if (!canSend) return
    setSending(true)
    try {
      await send(conversationId, {
        body: body.trim(),
        files: attachments.map((item) => item.file),
        replyTo: replyTo?.id ?? null,
      })
      attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
      setBody('')
      setAttachments([])
      onClearReply()
      notifyTyping(conversationId, false)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not send your message.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex items-start gap-2 rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2">
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium">Replying to {replyTo.sender.name}</p>
            <p className="truncate text-muted-foreground">{summarizeMessage(replyTo)}</p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attachments.map((item) => (
            <li key={item.id} className="relative overflow-hidden rounded-md border bg-muted/40">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.file.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 flex-col items-center justify-center gap-1 p-2 text-center">
                  <Mic className="size-4 text-muted-foreground" />
                  <span className="line-clamp-1 text-xs">{item.file.name}</span>
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {formatBytes(item.file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-0.5">
          {PICKERS.map(({ kind, icon: Icon, label }) => (
            <Button
              key={kind}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={label}
              onClick={() => openPicker(kind)}
              disabled={sending || attachments.length >= MAX_MESSAGE_ATTACHMENTS}
              className="text-muted-foreground hover:text-primary"
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>

        <Textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value.slice(0, BODY_LIMIT))
            // Emptying the box is as good as stopping; the store throttles the
            // rest so this is not a frame per keystroke.
            notifyTyping(conversationId, event.target.value.length > 0)
          }}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is how you write a second line.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="Write a message…"
          rows={1}
          className={cn('max-h-32 min-h-9 flex-1 resize-none py-2')}
        />

        <Button type="button" size="icon" onClick={() => void submit()} disabled={!canSend}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files)
          // Reset so selecting the same file twice still fires a change event.
          event.target.value = ''
        }}
      />
    </div>
  )
}
