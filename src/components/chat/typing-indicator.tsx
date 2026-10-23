import { UserAvatar } from '@/components/user-avatar'
import type { User } from '@/types/api'

/** Three dots where the next incoming message will be. */
export function TypingIndicator({ user }: { user: User }) {
  return (
    <div className="flex items-end gap-2">
      <UserAvatar user={user} className="size-8" />
      <div
        role="status"
        aria-label={`${user.name} is typing`}
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-3"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            // Staggered so the three read as one wave rather than a blink.
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
          />
        ))}
      </div>
    </div>
  )
}
