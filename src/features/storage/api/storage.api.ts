import { supabase } from '@/lib/supabase'

/**
 * Storage access.
 *
 * Object keys are always `<user-id>/<filename>`. That is not cosmetic: the
 * bucket policies compare `(storage.foldername(name))[1]` to auth.uid(), so a
 * key without the owner prefix is rejected on write and invisible on read.
 * Every path in this module is built by `ownedPath`, never by a caller.
 */

export const BUCKETS = {
  avatars: 'avatars',
  attachments: 'attachments',
} as const

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]

/** Mirrors the file_size_limit and allowed_mime_types set on each bucket. */
export const BUCKET_LIMITS = {
  avatars: {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPG, PNG or WebP up to 2 MB',
  },
  attachments: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    label: 'Image, PDF, Word or Excel up to 10 MB',
  },
} as const satisfies Record<BucketName, { maxBytes: number; mimeTypes: readonly string[]; label: string }>

export interface ValidationFailure {
  ok: false
  reason: string
}

export type ValidationResult = { ok: true } | ValidationFailure

/**
 * Client-side pre-check. The bucket enforces the same limits server-side, so
 * this exists to fail in 0 ms with a specific message rather than after a
 * 10 MB upload returns a generic 413.
 */
export function validateFile(bucket: BucketName, file: File): ValidationResult {
  const limits = BUCKET_LIMITS[bucket]

  if (file.size > limits.maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    const maxMb = limits.maxBytes / 1024 / 1024
    return { ok: false, reason: `That file is ${mb} MB. The limit is ${maxMb} MB.` }
  }

  if (file.size === 0) {
    return { ok: false, reason: 'That file is empty.' }
  }

  if (!(limits.mimeTypes as readonly string[]).includes(file.type)) {
    return { ok: false, reason: `That file type is not allowed. Accepted: ${limits.label}.` }
  }

  return { ok: true }
}

/**
 * Slugged, timestamped, and always under the owner's folder.
 *
 * The original name is slugged because Supabase Storage keys reject a range of
 * characters that filenames routinely contain, and a timestamp prevents two
 * uploads of "scan.pdf" from overwriting each other.
 */
function ownedPath(userId: string, file: File): string {
  const lastDot = file.name.lastIndexOf('.')
  const stem = lastDot > 0 ? file.name.slice(0, lastDot) : file.name
  const extension = lastDot > 0 ? file.name.slice(lastDot + 1).toLowerCase() : 'bin'

  const slug =
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'file'

  return `${userId}/${Date.now()}-${slug}.${extension}`
}

export interface UploadedFile {
  path: string
  name: string
  size: number
  mimeType: string
}

export async function uploadFile(
  bucket: BucketName,
  userId: string,
  file: File,
): Promise<UploadedFile> {
  const validation = validateFile(bucket, file)
  if (!validation.ok) throw new Error(validation.reason)

  const path = ownedPath(userId, file)

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    // Keys are timestamped, so a collision means something is wrong — failing
    // is better than silently replacing a file someone else is referencing.
    upsert: false,
    contentType: file.type,
    cacheControl: '3600',
  })

  if (error) throw error

  return { path, name: file.name, size: file.size, mimeType: file.type }
}

export async function removeFile(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

/** Avatars live in a public bucket, so this URL needs no signing and no expiry. */
export function getPublicUrl(path: string): string {
  return supabase.storage.from(BUCKETS.avatars).getPublicUrl(path).data.publicUrl
}

/**
 * Attachments are private. A signed URL is minted per view and expires, so a
 * link that leaks out of the app stops working — and RLS still governs whether
 * the caller could mint it at all.
 */
export async function getSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.attachments)
    .createSignedUrl(path, expiresInSeconds)

  if (error) throw error
  return data.signedUrl
}

/** Filename as the user recognises it, recovered from the stored key. */
export function displayName(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/^\d{10,}-/, '')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
