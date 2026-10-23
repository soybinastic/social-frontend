import { PostComposer } from '@/components/posts/post-composer'
import { PostFeed } from '@/components/posts/post-feed'
import { HOME_LIST } from '@/stores/feed-store'

export function FeedPage() {
  return (
    <div className="space-y-4">
      <PostComposer />
      <PostFeed
        listKey={HOME_LIST}
        emptyTitle="Your feed is empty"
        emptyDescription="Share a photo, a clip, or a track to get things started."
      />
    </div>
  )
}
