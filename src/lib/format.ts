const UNITS: [limit: number, divisor: number, suffix: string][] = [
  [60, 1, 's'],
  [3600, 60, 'm'],
  [86400, 3600, 'h'],
  [604800, 86400, 'd'],
]

/** Compact relative time, e.g. "just now", "4m", "3d", then a date. */
export function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 45) return 'just now'

  for (const [limit, divisor, suffix] of UNITS) {
    if (seconds < limit) return `${Math.floor(seconds / divisor)}${suffix}`
  }

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function initials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
