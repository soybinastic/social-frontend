import { Loader2, UserCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { toErrorMessage } from '@/lib/api/errors'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/stores/auth-store'
import type { FollowState, Profile } from '@/types/api'

interface FollowButtonProps {
  user: Profile
  /** Receives the optimistic state, then the server's counts. */
  onChange: (state: FollowState) => void
  size?: 'sm' | 'default'
}

/** Following is one-directional, so following back is an ordinary follow. */
function label(user: Profile): string {
  if (user.is_following) return 'Following'
  return user.follows_you ? 'Follow back' : 'Follow'
}

export function FollowButton({ user, onChange, size = 'sm' }: FollowButtonProps) {
  const viewer = useAuthStore((state) => state.user)
  const [pending, setPending] = useState(false)

  // Nobody follows themselves, so the button simply does not exist there.
  if (viewer?.username === user.username) return null

  async function toggle() {
    const following = !user.is_following
    setPending(true)

    // Optimistic: reflect the tap now, reconcile with the server's counts after.
    onChange({
      is_following: following,
      follows_you: user.follows_you,
      follower_count: Math.max(0, user.follower_count + (following ? 1 : -1)),
      following_count: user.following_count,
    })

    try {
      onChange(
        following ? await usersApi.follow(user.username) : await usersApi.unfollow(user.username),
      )
    } catch (error) {
      onChange(user)
      toast.error(
        toErrorMessage(
          error,
          following ? 'Could not follow this account.' : 'Could not unfollow this account.',
        ),
      )
    } finally {
      setPending(false)
    }
  }

  const Icon = user.is_following ? UserCheck : UserPlus

  return (
    <Button
      variant={user.is_following ? 'outline' : 'default'}
      size={size}
      disabled={pending}
      onClick={toggle}
      className="shrink-0"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label(user)}
    </Button>
  )
}
