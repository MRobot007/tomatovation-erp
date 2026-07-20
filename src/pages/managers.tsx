import { UserCog, Users } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useManagersWithReports } from '@/features/employees/hooks/use-employees'

/**
 * Deliberately not a table. The question this page answers is "who reports to
 * whom" — a shape, not a list of values. Rows would flatten exactly the
 * structure someone opened this to see.
 */
export function ManagersPage() {
  const { data, isLoading, error, refetch } = useManagersWithReports()

  const unassigned = data?.filter((entry) => entry.reports.length === 0).length ?? 0

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Managers"
        description="Reporting lines decide what each manager can see. A manager reads the attendance, work logs and leave of their direct reports — and no further up or across."
        actions={
          data && (
            <Badge tone="neutral">
              {data.length} {data.length === 1 ? 'manager' : 'managers'}
            </Badge>
          )
        }
      />

      {error && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <Card>
          <EmptyState
            icon={UserCog}
            title="No managers yet"
            description="Set someone's role to Manager on the Employees screen, then assign their reports."
          />
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          {unassigned > 0 && (
            <p className="mb-4 rounded border border-info/25 bg-info-soft px-3 py-2 text-sm text-info">
              {unassigned} {unassigned === 1 ? 'manager has' : 'managers have'} no direct reports yet.
              Until someone reports to them, they see only their own records.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map(({ manager, reports }) => (
              <Card key={manager.id} className="flex flex-col">
                <CardContent className="flex-1 pt-5">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={manager.name} src={manager.profile_photo} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-md font-semibold text-ink">
                        {manager.name}
                      </p>
                      <p className="truncate text-xs text-ink-subtle">{manager.email}</p>
                      {manager.department && (
                        <p className="mt-1 text-xs text-ink-muted">{manager.department}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="eyebrow">Direct reports</p>
                      <span className="font-mono text-xs text-ink-muted" data-numeric>
                        {reports.length}
                      </span>
                    </div>

                    {reports.length === 0 ? (
                      <p className="text-sm text-ink-subtle">None assigned</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {reports.map((report) => (
                          <li key={report.id} className="flex items-center gap-2">
                            <UserAvatar name={report.name} src={report.profile_photo} size="xs" />
                            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                              {report.name}
                            </span>
                            {report.status !== 'active' && (
                              <Badge tone="neutral">{report.status}</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export { Users }
