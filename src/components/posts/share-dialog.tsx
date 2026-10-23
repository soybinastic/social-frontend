import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { MediaGallery } from '@/components/media/attachments'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toErrorMessage } from '@/lib/api/errors'
import { useFeedStore } from '@/stores/feed-store'
import type { Post, SharedPost } from '@/types/api'

interface ShareDialogProps {
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareDialog({ post, open, onOpenChange }: ShareDialogProps) {
  const sharePost = useFeedStore((state) => state.sharePost)
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Resharing a reshare credits the original, matching the server's rule.
  const original: SharedPost | Post = post.shared_from ?? post

  async function submit() {
    setSubmitting(true)
    try {
      await sharePost(post.id, caption.trim())
      toast.success('Shared to your feed.')
      setCaption('')
      onOpenChange(false)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not share this post.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this post</DialogTitle>
          <DialogDescription>
            Add your own words, or share it as it is. It will appear on your profile.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value.slice(0, 2200))}
          placeholder="Say something about this..."
          rows={3}
          className="resize-none"
        />

        <div className="max-h-64 overflow-y-auto rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <UserAvatar user={original.author} className="size-7" />
            <span className="text-sm font-medium">{original.author.name}</span>
            <span className="text-xs text-muted-foreground">@{original.author.username}</span>
          </div>
          {original.caption && <p className="mt-2 text-sm whitespace-pre-wrap">{original.caption}</p>}
          <MediaGallery assets={original.media} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
