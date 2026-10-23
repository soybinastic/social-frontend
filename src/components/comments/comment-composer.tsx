import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

/** Matches `MAX_COMMENT_LENGTH` in apps/comments/services.py. */
const BODY_LIMIT = 1000

interface CommentComposerProps {
  onSubmit: (body: string) => Promise<unknown>
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

export function CommentComposer({
  onSubmit,
  placeholder = 'Write a comment…',
  autoFocus = false,
  className,
}: CommentComposerProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const trimmed = body.trim()

  async function submit() {
    if (!trimmed || sending) return

    setSending(true)
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not post your comment.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, BODY_LIMIT))}
        onKeyDown={(event) => {
          // Enter sends, as it does in the chat composer; Shift+Enter is a newline.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void submit()
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        className="min-h-9 resize-none py-2"
      />
      <Button
        size="icon"
        onClick={() => void submit()}
        disabled={!trimmed || sending}
        aria-label="Post comment"
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  )
}
