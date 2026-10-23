import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { User } from '@/types/api'

interface UserAvatarProps {
  user: Pick<User, 'name' | 'username' | 'avatar'>
  className?: string
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-10', className)}>
      {user.avatar ? (
        <AvatarImage src={user.avatar.thumbnail_url || user.avatar.url} alt={user.name} />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
        {initials(user.name || user.username)}
      </AvatarFallback>
    </Avatar>
  )
}
