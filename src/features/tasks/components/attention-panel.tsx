import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * What a manager or super admin should look at right now.
 *
 * Backed by tasks_needing_attention, which is SECURITY INVOKER — so RLS scopes
 * it: a manager sees their direct reports, a super admin sees everyone. No role
 * branch here.
 *
 * Only work assigned by someone else appears. A task you assigned to yourself
 * and finished is not news to you.
 */
async function fetchAttention() {
  const { data, error } = await supabase.rpc('tasks_needing_attention', { p_limit: 8 })
  if (error) throw error
  return data ?? []
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

export function AttentionPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'needing-attention'],
    queryFn: fetchAttention,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Nothing blocked and nothing finished recently is a good state, not an
  // empty one — so the panel disappears rather than showing a hollow card.
  if (!data || data.length === 0) return null

  const blocked = data.filter((row) => row.status === 'blocked').length

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="eyebrow">Your team's tasks</p>
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link to="/tasks?scope=team">
              All tasks <ArrowRight className="size-3" aria-hidden />
            </Link>
          </Button>
        </div>

        {blocked > 0 && (
          <p className="mb-3 flex items-center gap-2 rounded border border-danger/25 bg-danger-soft px-2.5 py-1.5 text-sm text-danger">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            {blocked} {blocked === 1 ? 'task is' : 'tasks are'} blocked and waiting on you
          </p>
        )}

        <ul className="divide-y divide-line">
          {data.map((row) => {
            const isBlocked = row.status === 'blocked'

            return (
              <li key={row.id}>
                <Link
                  to={`/tasks?highlight=${row.id}`}
                  className="flex items-center gap-2.5 py-2 transition-colors hover:text-tomato"
                >
                  {isBlocked ? (
                    <CircleAlert className="size-3.5 shrink-0 text-danger" aria-hidden />
                  ) : (
                    <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-base', isBlocked ? 'text-ink' : 'text-ink-muted')}>
                      {row.title}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {row.assignee_name}
                      {' · '}
                      {relative(row.status === 'done' ? (row.completed_at ?? row.updated_at) : row.updated_at)}
                    </span>
                  </span>

                  <Badge tone={isBlocked ? 'danger' : 'success'}>
                    {isBlocked ? 'Blocked' : 'Done'}
                  </Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
