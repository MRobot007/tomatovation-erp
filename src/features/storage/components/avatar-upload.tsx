import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  BUCKET_LIMITS,
  getPublicUrl,
  removeFile,
  uploadFile,
  validateFile,
} from '../api/storage.api'
import { useAuth } from '@/features/auth/auth-context'
import { useUpdateEmployee } from '@/features/employees/hooks/use-employees'

/**
 * Profile photo control.
 *
 * The avatars bucket is public, so the stored value is a plain URL rather than
 * an object key — it appears in every roster row and table cell, and minting a
 * signed URL per avatar would mean dozens of round trips per screen.
 *
 * The object key is recovered from the URL when replacing or deleting, so the
 * old file is still cleaned up.
 */
export function AvatarUpload() {
  const { profile, user, refetchProfile } = useAuth()
  const updateEmployee = useUpdateEmployee()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!profile || !user) return null

  /** `https://…/storage/v1/object/public/avatars/<uid>/<file>` -> `<uid>/<file>` */
  function keyFromUrl(url: string | null): string | null {
    if (!url) return null
    const marker = '/avatars/'
    const index = url.indexOf(marker)
    return index === -1 ? null : url.slice(index + marker.length)
  }

  async function handleFile(file: File) {
    setError(null)

    const validation = validateFile('avatars', file)
    if (!validation.ok) {
      setError(validation.reason)
      return
    }

    setUploading(true)
    const previousKey = keyFromUrl(profile!.profile_photo)

    try {
      const uploaded = await uploadFile('avatars', user!.id, file)
      await updateEmployee.mutateAsync({
        id: profile!.id,
        patch: { profile_photo: getPublicUrl(uploaded.path) },
      })
      refetchProfile()

      if (previousKey) {
        // Best effort — a stale object is untidy, not broken.
        await removeFile('avatars', previousKey).catch(() => {})
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setError(null)
    const key = keyFromUrl(profile!.profile_photo)

    setUploading(true)
    try {
      await updateEmployee.mutateAsync({ id: profile!.id, patch: { profile_photo: null } })
      refetchProfile()
      if (key) await removeFile('avatars', key).catch(() => {})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="group relative">
        <UserAvatar name={profile.name} src={profile.profile_photo} size="xl" />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile photo"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/55 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-white" aria-hidden />
          ) : (
            <Camera className="size-5 text-white" aria-hidden />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={BUCKET_LIMITS.avatars.mimeTypes.join(',')}
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ''
        }}
      />

      <div className="mt-2 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {profile.profile_photo ? 'Change photo' : 'Add photo'}
        </Button>

        {profile.profile_photo && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove photo"
            disabled={uploading}
            onClick={handleRemove}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1 max-w-48 text-center text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
