import { FileAudio } from 'lucide-react'
import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'
import { formatBytes, formatDuration } from '@/lib/format'
import type { MediaAsset, MediaKind } from '@/types/api'

interface AttachmentProps {
  asset: MediaAsset
  className?: string
}

function ImageAttachment({ asset, className }: AttachmentProps) {
  return (
    <img
      src={asset.thumbnail_url || asset.url}
      alt={asset.original_filename || 'Attached image'}
      loading="lazy"
      // Reserving the intrinsic ratio keeps the feed from jumping as images load.
      style={asset.width && asset.height ? { aspectRatio: `${asset.width}/${asset.height}` } : undefined}
      className={cn('w-full rounded-lg border bg-muted object-cover', className)}
    />
  )
}

function VideoAttachment({ asset, className }: AttachmentProps) {
  return (
    <video
      controls
      preload="metadata"
      poster={asset.thumbnail_url || undefined}
      className={cn('w-full rounded-lg border bg-black', className)}
    >
      <source src={asset.url} type={asset.mime_type || undefined} />
      Your browser cannot play this video.
    </video>
  )
}

function AudioAttachment({ asset, className }: AttachmentProps) {
  const duration = formatDuration(asset.duration_seconds)

  return (
    <div className={cn('rounded-lg border bg-muted/40 p-3', className)}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileAudio className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {asset.original_filename || 'Audio track'}
          </p>
          <p className="text-xs text-muted-foreground">
            {[duration, formatBytes(asset.byte_size)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <audio controls preload="metadata" className="w-full">
        <source src={asset.url} type={asset.mime_type || undefined} />
        Your browser cannot play this audio.
      </audio>
    </div>
  )
}

/**
 * Renderer per media kind, mirroring the backend's kind registry.
 *
 * Supporting a new kind means adding a component and one entry here; nothing
 * that renders attachments needs to change.
 */
const RENDERERS: Record<MediaKind, ComponentType<AttachmentProps>> = {
  image: ImageAttachment,
  video: VideoAttachment,
  audio: AudioAttachment,
}

export function Attachment({ asset, className }: AttachmentProps) {
  const Renderer = RENDERERS[asset.kind]
  if (!Renderer) return null
  return <Renderer asset={asset} className={className} />
}

export function MediaGallery({ assets }: { assets: MediaAsset[] }) {
  if (assets.length === 0) return null

  // Several images read best as a grid; anything with playable media gets its
  // own full-width row so the controls stay usable.
  const imagesOnly = assets.every((asset) => asset.kind === 'image')
  const useGrid = imagesOnly && assets.length > 1

  return (
    <div className={cn('mt-3 gap-2', useGrid ? 'grid grid-cols-2' : 'flex flex-col')}>
      {assets.map((asset, index) => (
        <Attachment
          key={`${asset.url}-${index}`}
          asset={asset}
          className={useGrid ? 'h-full max-h-64' : 'max-h-[32rem]'}
        />
      ))}
    </div>
  )
}
