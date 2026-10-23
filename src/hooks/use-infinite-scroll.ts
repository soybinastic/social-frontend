import { useEffect, useRef } from 'react'

/**
 * Calls `onReach` when the returned sentinel scrolls into view.
 *
 * The callback lives in a ref so the observer is not torn down and rebuilt on
 * every render, which would retrigger it and cause duplicate page loads.
 */
export function useInfiniteScroll(onReach: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onReach)

  useEffect(() => {
    callbackRef.current = onReach
  }, [onReach])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !enabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callbackRef.current()
      },
      // Start fetching slightly before the sentinel is visible.
      { rootMargin: '300px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled])

  return sentinelRef
}
