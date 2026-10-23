import { Heart, MessageCircle, MoreHorizontal, Repeat2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CommentThread } from '@/components/comments/comment-thread'
import { MediaGallery } from '@/components/media/attachments'
import { PostCaption } from '@/components/posts/post-caption'
import { ShareDialog } from '@/components/posts/share-dialog'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toErrorMessage } from '@/lib/api/errors'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useFeedStore } from '@/stores/feed-store'
import type { Post, SharedPost } from '@/types/api'

function AuthorLine({
  author,
  createdAt,
  compact = false,
}: {
  author: Post['author']
  createdAt: string
  compact?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link to={`/u/${author.username}`} className="shrink-0">
        <UserAvatar user={author} className={compact ? 'size-7' : 'size-10'} />
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        <Link to={`/u/${author.username}`} className="truncate text-sm font-semibold hover:underline">
          {author.name}
        </Link>
        <span className="truncate text-xs text-muted-foreground">@{author.username}</span>
        <span className="text-xs text-muted-foreground">· {relativeTime(createdAt)}</span>
      </div>
    </div>
  )
}

function QuotedPost({ post }: { post: SharedPost }) {
  return (
    <div className="mt-3 rounded-lg border p-3">
      <AuthorLine author={post.author} createdAt={post.created_at} compact />
      {post.caption && <PostCaption caption={post.caption} lines={3} className="mt-2" />}
      <MediaGallery assets={post.media} />
    </div>
  )
}

interface PostCardProps {
  post: Post
  /** Open on the post's own page, where the conversation is the point. */
  commentsOpen?: boolean
}

export function PostCard({ post, commentsOpen = false }: PostCardProps) {
  const setLiked = useFeedStore((state) => state.setLiked)
  const removePost = useFeedStore((state) => state.removePost)
  const [shareOpen, setShareOpen] = useState(false)
  const [showComments, setShowComments] = useState(commentsOpen)

  async function toggleLike() {
    try {
      await setLiked(post.id, !post.liked)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not update your like.'))
    }
  }

  async function remove() {
    try {
      await removePost(post.id)
      toast.success('Post deleted.')
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not delete this post.'))
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <AuthorLine author={post.author} createdAt={post.created_at} />
        {post.is_mine && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Post options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {post.shared_from && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat2 className="size-3.5" />
          Shared a post
        </p>
      )}

      {post.caption && <PostCaption caption={post.caption} className="mt-2" />}

      <MediaGallery assets={post.media} />
      {post.shared_from && <QuotedPost post={post.shared_from} />}

      <div className="mt-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          aria-pressed={post.liked}
          className={cn(
            'gap-1.5 text-muted-foreground hover:text-rose-600',
            post.liked && 'text-rose-600',
          )}
        >
          <Heart className={cn('size-4', post.liked && 'fill-current')} />
          <span className="tabular-nums">{post.like_count}</span>
          <span className="sr-only">{post.liked ? 'Unlike' : 'Like'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments((open) => !open)}
          aria-expanded={showComments}
          className={cn(
            'gap-1.5 text-muted-foreground hover:text-primary',
            showComments && 'text-primary',
          )}
        >
          <MessageCircle className="size-4" />
          <span className="tabular-nums">{post.comment_count}</span>
          <span className="sr-only">{showComments ? 'Hide comments' : 'Comments'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="gap-1.5 text-muted-foreground hover:text-emerald-600"
        >
          <Repeat2 className="size-4" />
          <span className="tabular-nums">{post.share_count}</span>
          <span className="sr-only">Share</span>
        </Button>
      </div>

      {showComments && <CommentThread postId={post.id} />}

      <ShareDialog post={post} open={shareOpen} onOpenChange={setShareOpen} />
    </Card>
  )
}
