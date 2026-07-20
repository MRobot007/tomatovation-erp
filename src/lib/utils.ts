import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Initials for avatar fallbacks: "Priya Sharma" -> "PS", "Anita" -> "AN". */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

/** 7.25 -> "7h 15m". Used everywhere hours are surfaced. */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (whole === 0) return `${minutes}m`
  if (minutes === 0) return `${whole}h`
  return `${whole}h ${minutes}m`
}
