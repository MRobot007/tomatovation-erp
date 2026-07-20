import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/ui/states'
import { Card } from '@/components/ui/card'

/**
 * Stand-in for routes whose feature lands in a later phase. It exists so the
 * shell and role-driven navigation can be exercised end to end now, and so a
 * nav link never dead-ends on a blank screen.
 */
export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <>
      <PageHeader eyebrow="Coming up" title={title} />
      <Card>
        <EmptyState
          icon={Construction}
          title={`${title} is not built yet`}
          description={`This screen lands in ${phase}. The route, role guard and navigation entry are already wired, so it will fill in without any further plumbing.`}
        />
      </Card>
    </>
  )
}
