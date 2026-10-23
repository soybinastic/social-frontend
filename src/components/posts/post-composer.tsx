import { Image as ImageIcon, Loader2, Music, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/lib/api/errors'
import { postsApi } from '@/lib/api/posts'
import { formatBytes } from '@/lib/format'
import { MAX_POST_ATTACHMENTS, MEDIA_RULES, detectKind, validateFile } from '@/lib/media-kinds'
import { cn } from '@/lib/utils'
import { HOME_LIST, useFeedStore } from '@/stores/feed-store'
import { useAuthStore } from '@/stores/auth-store'
import type { MediaKind } from '@/types/api'

const CAPTION_LIMIT = 2200

interface PendingAttachment {
  id: string
  file: File
  kind: MediaKind
  /** Object URL for image thumbnails; revoked when the item is dropped. */
  previewUrl: string | null
}

const PICKERS: { kind: MediaKind; icon: typeof ImageIcon; label: string }[] = [
  { kind: 'image', icon: ImageIcon, label: 'Photo' },
  { kind: 'video', icon: Video, label: 'Video' },
  { kind: 'audio', icon: Music, label: 'Audio' },
]

export function PostComposer() {
  const user = useAuthStore((state) => state.user)
  const addPost = useFeedStore((state) => state.addPost)

  const [caption, setCaption] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const acceptRef = useRef<string>('')

  // Object URLs are leaked memory until revoked, so release them on unmount.
  useEffect(
    () => () => {
      attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
    },
    [attachments],
  )

  const canSubmit = (caption.trim().length > 0 || attachments.length > 0) && !submitting

  function openPicker(kind: MediaKind) {
    acceptRef.current = MEDIA_RULES[kind].accept
    // The accept attribute is set imperatively so one input serves all pickers.
    if (inputRef.current) {
      inputRef.current.accept = acceptRef.current
      inputRef.current.click()
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return

    const accepted: PendingAttachment[] = []
    for (const file of Array.from(files)) {
      if (attachments.length + accepted.length >= MAX_POST_ATTACHMENTS) {
        toast.error(`A post can hold at most ${MAX_POST_ATTACHMENTS} attachments.`)
        break
      }
      const problem = validateFile(file)
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
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const post = await postsApi.create({
        caption: caption.trim(),
        files: attachments.map((item) => item.file),
      })
      addPost(post, HOME_LIST)
      attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
      setCaption('')
      setAttachments([])
      toast.success('Posted.')
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not publish your post.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <Textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value.slice(0, CAPTION_LIMIT))}
            placeholder="What's happening?"
            rows={3}
            className="resize-none border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          {attachments.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachments.map((item) => (
                <li
                  key={item.id}
                  className="group relative overflow-hidden rounded-md border bg-muted/40"
                >
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 flex-col items-center justify-center gap-1 p-2 text-center">
                      {item.kind === 'video' ? (
                        <Video className="size-5 text-muted-foreground" />
                      ) : (
                        <Music className="size-5 text-muted-foreground" />
                      )}
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

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {PICKERS.map(({ kind, icon: Icon, label }) => (
                <Button
                  key={kind}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openPicker(kind)}
                  disabled={submitting || attachments.length >= MAX_POST_ATTACHMENTS}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Icon className="size-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">{label}</span>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs tabular-nums text-muted-foreground',
                  caption.length > CAPTION_LIMIT - 100 && 'text-destructive',
                )}
              >
                {caption.length}/{CAPTION_LIMIT}
              </span>
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Post
              </Button>
            </div>
          </div>
        </div>
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
    </Card>
  )
}
