import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { PresenceDot, PRESENCE_STATUSES } from '@/components/presence-dot'
import { Inbox } from 'lucide-react'

/**
 * Living reference for the Warm Editorial direction. Kept in the app (behind a
 * route) rather than in a separate Storybook so the tokens it renders are
 * always the tokens production ships.
 */
export function DesignSystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Design system"
        description="Warm Editorial — warm-neutral paper surfaces, Fraunces display cut against Inter UI text, tomato as the single brand signal, and status carried by soft tinted fields."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Colour">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Paper', 'bg-paper'],
              ['Surface', 'bg-surface'],
              ['Elevated', 'bg-elevated'],
              ['Sunken', 'bg-sunken'],
              ['Tomato', 'bg-tomato'],
              ['Success', 'bg-success'],
              ['Warning', 'bg-warning'],
              ['Danger', 'bg-danger'],
            ].map(([name, cls]) => (
              <div key={name}>
                <div className={`h-12 rounded border border-line ${cls}`} />
                <p className="mt-1.5 text-2xs text-ink-muted">{name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale">
          <div className="space-y-2">
            <p className="eyebrow">Eyebrow · tracked caps</p>
            <p className="font-display text-3xl font-semibold tracking-tight">Display 3xl</p>
            <p className="font-display text-2xl font-semibold tracking-tight">Display 2xl</p>
            <p className="text-lg">Body large — 17px</p>
            <p className="text-base">Body base — 14px, the UI default</p>
            <p className="text-sm text-ink-muted">Small — 13px, secondary</p>
            <p className="font-mono text-sm" data-numeric>
              Mono 09:14 · 8.25h · 1,284
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Status & presence">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral" dot>
              Draft
            </Badge>
            <Badge tone="brand" dot>
              Active
            </Badge>
            <Badge tone="success" dot>
              Approved
            </Badge>
            <Badge tone="warning" dot>
              Pending
            </Badge>
            <Badge tone="danger" dot>
              Rejected
            </Badge>
            <Badge tone="info" dot>
              In review
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {PRESENCE_STATUSES.map((status) => (
              <PresenceDot key={status} status={status} showLabel />
            ))}
          </div>
        </Section>

        <Section title="Form controls">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ds-name" required>
                Project
              </Label>
              <Input id="ds-name" placeholder="e.g. Q3 onboarding revamp" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-invalid">Hours</Label>
              <Input id="ds-invalid" aria-invalid defaultValue="26" />
              <p className="text-xs text-danger">A day cannot exceed 24 hours.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-notes">Notes</Label>
              <Textarea id="ds-notes" placeholder="What moved forward today?" />
            </div>
          </div>
        </Section>

        <Section title="People">
          <div className="flex items-center gap-3">
            <UserAvatar name="Priya Sharma" size="xs" />
            <UserAvatar name="Rahul Mehta" size="sm" />
            <UserAvatar name="Anita Kulkarni" size="md" />
            <UserAvatar name="Devendra Rao" size="lg" />
            <UserAvatar name="Sana Qureshi" size="xl" />
          </div>
        </Section>

        <Section title="Loading">
          <div className="space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="mt-4 overflow-hidden rounded border border-line">
            <TableSkeleton rows={3} columns={4} />
          </div>
        </Section>

        <Section title="Empty & error">
          <div className="grid gap-3">
            <div className="rounded border border-line">
              <EmptyState
                icon={Inbox}
                title="No work logs yet"
                description="Logs submitted by your team will appear here."
                action={<Button variant="primary" size="sm">Add a log</Button>}
              />
            </div>
            <div className="rounded border border-line">
              <ErrorState error={new Error('permission denied for table work_logs')} onRetry={() => {}} />
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
