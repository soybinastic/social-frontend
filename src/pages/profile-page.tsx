import { CalendarDays, Camera, Loader2, Pencil } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { MessageButton } from '@/components/chat/message-button'
import { PostFeed } from '@/components/posts/post-feed'
import { FollowButton } from '@/components/users/follow-button'
import { UserAvatar } from '@/components/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { authApi } from '@/lib/api/auth'
import { toErrorMessage } from '@/lib/api/errors'
import { usersApi } from '@/lib/api/users'
import { validateFile } from '@/lib/media-kinds'
import { useAuthStore } from '@/stores/auth-store'
import { userList } from '@/stores/feed-store'
import type { Profile, User } from '@/types/api'

function EditProfileDialog({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ display_name: user.display_name, bio: user.bio })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      onSaved(await authApi.updateProfile(form))
      toast.success('Profile updated.')
      setOpen(false)
    } catch (error) {
      toast.error(toErrorMessage(error, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={form.display_name}
              maxLength={80}
              onChange={(event) => setForm({ ...form, display_name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={3}
              maxLength={280}
              className="resize-none"
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
            <p className="text-right text-xs text-muted-foreground">{form.bio.length}/280</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProfilePage() {
  const { username = '' } = useParams<{ username: string }>()
  const currentUser = useAuthStore((state) => state.user)
  const setCurrentUser = useAuthStore((state) => state.setUser)

  // Both pieces of state are tagged with the username they describe, so the
  // view derives its own loading state when the route changes instead of
  // resetting state from inside the effect.
  const [loaded, setLoaded] = useState<{ username: string; user: Profile } | null>(null)
  const [failed, setFailed] = useState<{ username: string; message: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const profile = loaded?.username === username ? loaded.user : null
  const error = failed?.username === username ? failed.message : null
  const isMe = currentUser?.username === username

  useEffect(() => {
    let cancelled = false

    usersApi
      .profile(username)
      .then((user) => {
        if (!cancelled) setLoaded({ username, user })
      })
      .catch((caught) => {
        if (!cancelled) {
          setFailed({ username, message: toErrorMessage(caught, 'Could not load this profile.') })
        }
      })

    return () => {
      cancelled = true
    }
  }, [username])

  const patchProfile = useCallback((changes: Partial<Profile>) => {
    setLoaded((current) =>
      current ? { ...current, user: { ...current.user, ...changes } } : current,
    )
  }, [])

  const applyUser = useCallback(
    (user: User) => {
      // Edits and avatar uploads return the plain account, so they are merged
      // in rather than replacing the profile and dropping its follow state.
      patchProfile(user)
      // Keep the header avatar and menu in step with the edited profile.
      if (isMe) setCurrentUser(user)
    },
    [isMe, patchProfile, setCurrentUser],
  )

  async function uploadAvatar(file: File) {
    const problem = validateFile(file)
    if (problem || file.type.startsWith('image/') === false) {
      toast.error(problem ?? 'Choose an image for your avatar.')
      return
    }

    setUploading(true)
    try {
      applyUser(await authApi.uploadAvatar(file))
      toast.success('Avatar updated.')
    } catch (caught) {
      toast.error(toErrorMessage(caught, 'Could not update your avatar.'))
    } finally {
      setUploading(false)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Profile unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        {profile ? (
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <UserAvatar user={profile} className="size-16" />
              {isMe && (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="Change avatar"
                    className="absolute -right-1 -bottom-1 rounded-full border bg-background p-1.5 shadow-sm transition hover:bg-muted"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void uploadAvatar(file)
                      event.target.value = ''
                    }}
                  />
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold">{profile.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
                    {profile.follows_you && !isMe && <Badge variant="secondary">Follows you</Badge>}
                  </div>
                </div>
                {isMe ? (
                  <EditProfileDialog user={profile} onSaved={applyUser} />
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <MessageButton username={profile.username} />
                    <FollowButton user={profile} onChange={patchProfile} />
                  </div>
                )}
              </div>

              {profile.bio && <p className="mt-2 text-sm whitespace-pre-wrap">{profile.bio}</p>}

              <div className="mt-2 flex items-center gap-4 text-sm">
                <Link to={`/u/${profile.username}/followers`} className="hover:underline">
                  <span className="font-semibold tabular-nums">{profile.follower_count}</span>{' '}
                  <span className="text-muted-foreground">
                    {profile.follower_count === 1 ? 'follower' : 'followers'}
                  </span>
                </Link>
                <Link to={`/u/${profile.username}/following`} className="hover:underline">
                  <span className="font-semibold tabular-nums">{profile.following_count}</span>{' '}
                  <span className="text-muted-foreground">following</span>
                </Link>
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Joined {new Date(profile.date_joined).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        )}
      </Card>

      <PostFeed
        listKey={userList(username)}
        emptyTitle={isMe ? 'You have not posted yet' : 'No posts yet'}
        emptyDescription={
          isMe ? 'Your posts will appear here.' : `@${username} has not shared anything.`
        }
      />
    </div>
  )
}
