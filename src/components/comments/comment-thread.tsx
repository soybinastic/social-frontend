import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'

import { CommentComposer } from '@/components/comments/comment-composer'
import { CommentItem } from '@/components/comments/comment-item'
import { Button } from '@/components/ui/button'
import { postThread, useCommentStore, useCommentThread } from '@/stores/comment-store'

/** The conversation under one post: a composer, the comments, and more on demand. */
export function CommentThread({ postId }: { postId: string }) {
  const loadThread = useCommentStore((state) => state.loadThread)
  const add = useCommentStore((state) => state.add)
  const key = postThread(postId)
  const { comments, loading, loadingMore, next, error } = useCommentThread(key)

  useEffect(() => {
    void loadThread(key)
  }, [key, loadThread])

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <CommentComposer onSubmit={(body) => add(postId, body)} />

      {loading && comments.length === 0 && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && comments.length === 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadThread(key)}>
            Try again
          </Button>
        </div>
      )}

      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}

      {next && (
        // Deliberately a button rather than an infinite scroll sentinel: a thread
        // sits inside the feed, where loading on scroll would fight the page.
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void loadThread(key, { more: true })}
          disabled={loadingMore}
        >
          {loadingMore ? <Loader2 className="size-4 animate-spin" /> : 'Show more comments'}
        </Button>
      )}
    </div>
  )
}
