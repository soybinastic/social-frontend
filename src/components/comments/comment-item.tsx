import { ChevronDown, ChevronUp, Heart, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CommentComposer } from '@/components/comments/comment-composer'
import { UserAvatar } from '@/components/user-avatar'
import { toErrorMessage } from '@/lib/api/errors'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { replyThread, useCommentStore, useCommentThread } from '@/stores/comment-store'
import type { Comment } from '@/types/api'

function repliesLabel(count: number): string {
  return count === 1 ? '1 reply' : `${count} replies`
}

export function CommentItem({ comment }: { comment: Comment }) {
  const setLiked = useCommentStore((state) => state.setLiked)
  const reply = useCommentStore((state) => state.reply)
  const remove = useCommentStore((state) => state.remove)

  const [replying, setReplying] = useState(false)
  const [showReplies, setShowReplies] = useState(false)

  const isReply = comment.parent !== null
  const threadKey = replyThread(comment.id)
  const loadThread = useCommentStore((state) => state.loadThread)
  const {
    comments: replies,
    loading: loadingReplies,
    error: repliesError,
  } = useCommentThread(threadKey)

  useEffect(() => {
    // Replies are fetched the first time somebody asks to see them, so a page of
    // comments does not drag every sub-thread along with it.
    if (showReplies && replies.length === 0) void loadThread(threadKey)
  }, [showReplies, replies.length, threadKey, loadThread])

  async function toggleLike() {
    try {
      await setLiked(comment.id, !comment.liked)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not update your like.'))
    }
  }

  async function submitReply(body: string) {
    await reply(comment.id, body)
    setReplying(false)
    setShowReplies(true)
  }

  async function confirmRemove() {
    try {
      await remove(comment.id)
      toast.success('Comment deleted.')
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not delete this comment.'))
    }
  }

  return (
    <div className="flex gap-2">
      <Link to={`/u/${comment.author.username}`} className="shrink-0">
        <UserAvatar user={comment.author} className={isReply ? 'size-7' : 'size-8'} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <Link
              to={`/u/${comment.author.username}`}
              className="truncate text-sm font-semibold hover:underline"
            >
              {comment.author.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              · {relativeTime(comment.created_at)}
            </span>
          </div>
          <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
        </div>

        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => void toggleLike()}
            aria-pressed={comment.liked}
            className={cn(
              'flex items-center gap-1 transition hover:text-rose-600',
              comment.liked && 'text-rose-600',
            )}
          >
            <Heart className={cn('size-3.5', comment.liked && 'fill-current')} />
            {comment.like_count > 0 && <span className="tabular-nums">{comment.like_count}</span>}
            <span className="sr-only">{comment.liked ? 'Unlike' : 'Like'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReplying((open) => !open)}
            className="transition hover:text-foreground"
          >
            Reply
          </button>

          {comment.can_delete && (
            <button
              type="button"
              onClick={() => void confirmRemove()}
              className="flex items-center gap-1 transition hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          )}
        </div>

        {replying && (
          <CommentComposer
            onSubmit={submitReply}
            placeholder={`Reply to ${comment.author.name}…`}
            autoFocus
            className="mt-2"
          />
        )}

        {/* Replies hang off the top-level comment only: answering an answer joins
            this same thread, so there is never a third level to render. */}
        {!isReply && comment.reply_count > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setShowReplies((open) => !open)}
              className="flex items-center gap-1 pl-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {showReplies ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {showReplies ? 'Hide replies' : repliesLabel(comment.reply_count)}
            </button>

            {showReplies && (
              <div className="mt-2 space-y-3 border-l pl-3">
                {loadingReplies && replies.length === 0 && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {repliesError && replies.length === 0 && (
                  <p className="text-xs text-destructive">{repliesError}</p>
                )}
                {replies.map((row) => (
                  <CommentItem key={row.id} comment={row} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
