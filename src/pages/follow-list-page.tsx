import { ArrowLeft, Loader2, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { FollowButton } from '@/components/users/follow-button'
import { UserAvatar } from '@/components/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { toErrorMessage } from '@/lib/api/errors'
import { usersApi } from '@/lib/api/users'
import type { FollowState, Page, Profile } from '@/types/api'

type Relation = 'followers' | 'following'

const COPY: Record<Relation, { title: string; empty: string }> = {
  followers: { title: 'Followers', empty: 'No one follows this account yet.' },
  following: { title: 'Following', empty: 'This account does not follow anyone yet.' },
}

interface Loaded {
  key: string
  profiles: Profile[]
  next: string | null
}

function ProfileRow({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (state: FollowState) => void
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Link to={`/u/${profile.username}`} className="shrink-0">
        <UserAvatar user={profile} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/u/${profile.username}`} className="text-sm font-semibold hover:underline">
          {profile.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
        {profile.bio && <p className="mt-1 line-clamp-2 text-sm">{profile.bio}</p>}
      </div>
      <FollowButton user={profile} onChange={onChange} />
    </div>
  )
}

export function FollowListPage({ relation }: { relation: Relation }) {
  const { username = '' } = useParams<{ username: string }>()
  const key = `${relation}:${username}`
  const fetchPage = relation === 'followers' ? usersApi.followers : usersApi.following

  // Both pieces of state are tagged with the list they describe, so the view
  // derives its own loading state when the route changes instead of resetting
  // state from inside the effect.
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const list = loaded?.key === key ? loaded : null
  const error = failed?.key === key ? failed.message : null

  useEffect(() => {
    let cancelled = false

    fetchPage(username)
      .then((page: Page<Profile>) => {
        if (!cancelled) setLoaded({ key, profiles: page.results, next: page.next })
      })
      .catch((caught) => {
        if (!cancelled) {
          setFailed({ key, message: toErrorMessage(caught, 'Could not load this list.') })
        }
      })

    return () => {
      cancelled = true
    }
    // `attempt` is what lets the retry button re-run an otherwise unchanged load.
  }, [fetchPage, key, username, attempt])

  async function loadMore() {
    if (!list?.next || loadingMore) return

    setLoadingMore(true)
    try {
      const page = await fetchPage(username, list.next)
      setLoaded({ key, profiles: [...list.profiles, ...page.results], next: page.next })
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Could not load more accounts.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const sentinelRef = useInfiniteScroll(() => void loadMore(), Boolean(list?.next) && !loadingMore)

  // A follow only changes the row it was clicked on, so the rest stay untouched.
  function applyState(target: string, state: FollowState) {
    setLoaded((current) =>
      current === null
        ? current
        : {
            ...current,
            profiles: current.profiles.map((profile) =>
              profile.username === target ? { ...profile, ...state } : profile,
            ),
          },
    )
  }

  function body() {
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Could not load this list</AlertTitle>
          <AlertDescription className="flex-col items-start gap-2">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailed(null)
                setAttempt((count) => count + 1)
              }}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (list === null) {
      return (
        <Card className="gap-0 divide-y py-0">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </Card>
      )
    }

    if (list.profiles.length === 0) {
      return (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <UsersRound className="size-8 text-muted-foreground" />
          <p className="font-medium">Nothing to show</p>
          <p className="text-sm text-muted-foreground">{COPY[relation].empty}</p>
        </Card>
      )
    }

    return (
      <Card className="gap-0 divide-y py-0">
        {list.profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            onChange={(state) => applyState(profile.username, state)}
          />
        ))}
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={`/u/${username}`} aria-label="Back to profile">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{COPY[relation].title}</h1>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>
        </div>
      </div>

      {body()}
    </div>
  )
}
