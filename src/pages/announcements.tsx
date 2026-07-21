import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormError, FormField } from '@/components/ui/form-field'
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from '@/features/admin/hooks/use-admin'
import type { AnnouncementRow } from '@/features/admin/api/admin.api'
import { useAuth } from '@/features/auth/auth-context'
import { atLeast } from '@/lib/roles'

const schema = z.object({
  title: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Title is required').max(200, 'Title is too long')),
  message: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Message is required').max(8000, 'Message is too long')),
  published: z.boolean(),
})

type FormInput = z.input<typeof schema>

export function AnnouncementsPage() {
  const { user, role } = useAuth()
  const canPost = atLeast(role, 'manager')
  const { data, isLoading, error, refetch } = useAnnouncements()

  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<AnnouncementRow | null>(null)
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null)
  const remove = useDeleteAnnouncement()

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Announcements"
        description="Published announcements notify every active employee immediately."
        actions={
          canPost && (
            <Button variant="primary" onClick={() => setComposing(true)}>
              <Plus aria-hidden />
              New announcement
            </Button>
          )
        }
      />

      {error && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description={
              canPost
                ? 'Post one and everyone gets notified.'
                : 'Company announcements will appear here.'
            }
            action={
              canPost ? (
                <Button variant="primary" size="sm" onClick={() => setComposing(true)}>
                  <Plus aria-hidden />
                  New announcement
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((announcement) => {
            const isAuthor = announcement.created_by === user?.id
            const canEdit = isAuthor || role === 'super_admin'

            return (
              <Card key={announcement.id} className="group">
                <CardContent className="pt-5">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
                        {announcement.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {announcement.author && (
                          <span className="flex items-center gap-1.5">
                            <UserAvatar
                              name={announcement.author.name}
                              src={announcement.author.profile_photo}
                              size="xs"
                            />
                            <span className="text-xs text-ink-subtle">
                              {announcement.author.name}
                            </span>
                          </span>
                        )}
                        <span className="font-mono text-xs text-ink-subtle">
                          {new Date(announcement.created_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {!announcement.published && <Badge tone="warning">Draft</Badge>}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit"
                          onClick={() => setEditing(announcement)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete"
                          onClick={() => setDeleting(announcement)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-md leading-relaxed text-ink-muted">
                    {announcement.message}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AnnouncementDialog announcement={null} open={composing} onOpenChange={setComposing} />
      <AnnouncementDialog
        announcement={editing}
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this announcement?"
        description={deleting ? `"${deleting.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
        }}
      />
    </>
  )
}

function AnnouncementDialog({
  announcement,
  open,
  onOpenChange,
}: {
  announcement: AnnouncementRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateAnnouncement()
  const update = useUpdateAnnouncement()
  const isEdit = announcement != null

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', message: '', published: true },
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      announcement
        ? {
            title: announcement.title,
            message: announcement.message,
            published: announcement.published,
          }
        : { title: '', message: '', published: true },
    )
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announcement?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.parse(values)
    if (announcement) await update.mutateAsync({ id: announcement.id, patch: parsed })
    else await create.mutateAsync(parsed)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          <DialogDescription>
            Publishing sends a notification to every active employee. Save as a draft to hold it
            back.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={create.error ?? update.error} />

            <FormField label="Title" error={form.formState.errors.title} required>
              {(field) => <Input {...field} {...form.register('title')} autoFocus />}
            </FormField>

            <FormField label="Message" error={form.formState.errors.message} required>
              {(field) => <Textarea {...field} {...form.register('message')} rows={8} />}
            </FormField>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                {...form.register('published')}
                className="size-3.5 rounded-sm border-line-strong text-brand focus:ring-brand/40"
              />
              Publish now and notify everyone
            </label>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Post announcement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
