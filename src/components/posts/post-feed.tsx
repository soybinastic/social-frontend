import { Loader2, MessageSquareDashed } from 'lucide-react'
import { useEffect } from 'react'

import { PostCard } from '@/components/posts/post-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { useFeedStore, usePostList } from '@/stores/feed-store'

function PostSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </Card>
  )
}

interface PostFeedProps {
  listKey: string
  emptyTitle?: string
  emptyDescription?: string
  /** Opens each card's comments, which a single-post page wants and a feed does not. */
  commentsOpen?: boolean
}

export function PostFeed({
  listKey,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Posts will show up here once they are created.',
  commentsOpen = false,
}: PostFeedProps) {
  const loadList = useFeedStore((state) => state.loadList)
  const { posts, loading, loadingMore, next, error } = usePostList(listKey)

  useEffect(() => {
    void loadList(listKey)
  }, [listKey, loadList])

  const sentinelRef = useInfiniteScroll(
    () => void loadList(listKey, { more: true }),
    Boolean(next) && !loadingMore,
  )

  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    )
  }

  if (error && posts.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load posts</AlertTitle>
        <AlertDescription className="flex-col items-start gap-2">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadList(listKey)}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (posts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <MessageSquareDashed className="size-8 text-muted-foreground" />
        <p className="font-medium">{emptyTitle}</p>
        <p className="text-sm text-muted-foreground">{emptyDescription}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} commentsOpen={commentsOpen} />
      ))}

      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}
