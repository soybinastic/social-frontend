import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const CLAMP_CLASSES = {
  3: 'line-clamp-3',
  6: 'line-clamp-6',
} as const

interface PostCaptionProps {
  caption: string
  /** Lines shown before the caption is cut off. */
  lines?: keyof typeof CLAMP_CLASSES
  className?: string
}

export function PostCaption({ caption, lines = 6, className }: PostCaptionProps) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)

  // Whether the clamp cut anything depends on layout, so it has to be measured
  // after paint and again whenever the column width changes. An expanded
  // caption always fits, so the last collapsed measurement is kept instead.
  useEffect(() => {
    const element = textRef.current
    if (!element || expanded) return

    const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // Web fonts can rewrap the text without resizing the element.
    void document.fonts.ready.then(measure)

    return () => observer.disconnect()
  }, [caption, expanded])

  return (
    <div className={className}>
      <p
        ref={textRef}
        className={cn('text-sm whitespace-pre-wrap', !expanded && CLAMP_CLASSES[lines])}
      >
        {caption}
      </p>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  )
}
