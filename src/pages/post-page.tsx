import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { PostFeed } from '@/components/posts/post-feed'
import { Button } from '@/components/ui/button'
import { postList } from '@/stores/feed-store'

/** Where a like, share or comment notification lands. */
export function PostPage() {
  const { postId = '' } = useParams<{ postId: string }>()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>

      <PostFeed
        listKey={postList(postId)}
        emptyTitle="Post unavailable"
        emptyDescription="It may have been deleted by its author."
        // A comment notification lands here, so the conversation is already open.
        commentsOpen
      />
    </div>
  )
}
