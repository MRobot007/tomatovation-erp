import { useCallback, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BUCKET_LIMITS,
  displayName,
  formatBytes,
  getSignedUrl,
  removeFile,
  uploadFile,
  validateFile,
  type BucketName,
} from '../api/storage.api'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  bucket: BucketName
  /** Stored object key, or null when nothing is attached. */
  value: string | null
  onChange: (path: string | null) => void
  disabled?: boolean
  label?: string
}

/**
 * Single-file attachment control with drag-and-drop.
 *
 * Uploads immediately rather than on form submit. Deferring would mean holding
 * the File in form state and uploading during submit, where a failure leaves
 * the user staring at a saved record with a silently missing attachment. This
 * way the upload either succeeded before they pressed save, or they know it
 * did not.
 */
export function FileUpload({ bucket, value, onChange, disabled, label }: FileUploadProps) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const limits = BUCKET_LIMITS[bucket]

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const validation = validateFile(bucket, file)
      if (!validation.ok) {
        setError(validation.reason)
        return
      }

      setUploading(true)
      try {
        const uploaded = await uploadFile(bucket, user!.id, file)

        // Replacing: drop the old object so the bucket does not accumulate
        // orphans nobody can reach.
        if (value) {
          await removeFile(bucket, value).catch(() => {
            // A failed cleanup must not fail the upload the user just made.
          })
        }

        onChange(uploaded.path)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [bucket, user, value, onChange],
  )

  async function handleRemove() {
    if (!value) return
    setError(null)
    const previous = value

    // Clear optimistically: the record should stop referencing the file even if
    // the storage delete fails, or the form saves a path to a deleted object.
    onChange(null)

    try {
      await removeFile(bucket, previous)
    } catch {
      // Orphaned object, but the record is consistent. Not worth alarming the
      // user over.
    }
  }

  if (value) {
    return (
      <div className="space-y-1.5">
        <AttachedFile path={value} onRemove={disabled ? undefined : handleRemove} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (disabled) return
          const file = event.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
        className={cn(
          'flex flex-col items-center justify-center rounded border border-dashed px-4 py-5 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-sunken/30',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
            <p className="mt-2 text-sm text-ink-muted">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className="size-4 text-ink-subtle" aria-hidden />
            <p className="mt-2 text-sm text-ink-muted">
              {label ?? 'Drag a file here, or'}{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">{limits.label}</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={limits.mimeTypes.join(',')}
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            // Reset so picking the same file twice still fires onChange.
            event.target.value = ''
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** A stored attachment, with a signed link minted only when clicked. */
export function AttachedFile({
  path,
  onRemove,
}: {
  path: string
  onRemove?: () => void
}) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = displayName(path)
  const isImage = /\.(jpe?g|png|webp)$/i.test(name)
  const Icon = isImage ? ImageIcon : FileText

  async function open() {
    setError(null)
    setOpening(true)
    try {
      // Minted on demand and short-lived, so a URL that escapes the app expires
      // rather than granting permanent access.
      const url = await getSignedUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Could not open that file')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded border border-line bg-elevated/50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />

      <button
        type="button"
        onClick={open}
        className="min-w-0 flex-1 truncate text-left text-sm text-ink transition-colors hover:text-brand"
      >
        {name}
      </button>

      {opening && <Loader2 className="size-3.5 animate-spin text-ink-subtle" aria-hidden />}

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

/** Compact read-only indicator for table rows. */
export function AttachmentBadge({ path }: { path: string | null }) {
  if (!path) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-ink-subtle"
      title={displayName(path)}
    >
      <Paperclip className="size-3" aria-hidden />
    </span>
  )
}

export { formatBytes }
