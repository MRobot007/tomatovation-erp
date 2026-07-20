import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { CornerDownLeft, Search } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useGlobalSearch } from './use-global-search'
import { useDebounced } from '@/hooks/use-debounced'
import { navForRole } from '@/config/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

/**
 * Command-K palette. Opens on the shortcut or on the topbar trigger, which
 * dispatches `erp:open-command-palette` so the trigger does not need a
 * reference to this component.
 */
export function CommandPalette() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 200)

  const { data, isFetching } = useGlobalSearch(debouncedQuery, open)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }
    const onOpenEvent = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('erp:open-command-palette', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('erp:open-command-palette', onOpenEvent)
    }
  }, [])

  // Clearing on close means reopening starts fresh rather than showing the
  // previous search's results for a frame.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  function go(to: string) {
    setOpen(false)
    navigate(to)
  }

  const pages = role ? navForRole(role) : []
  const matchingPages = query
    ? pages.filter((page) => page.label.toLowerCase().includes(query.toLowerCase()))
    : pages.slice(0, 6)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2',
            'overflow-hidden rounded-lg border border-line bg-surface shadow-lg',
            'data-[state=open]:animate-rise-in',
          )}
          aria-label="Search"
        >
          <Dialog.Title className="sr-only">Search everything</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search employees, leads, tasks and work logs, or jump to a page.
          </Dialog.Description>

          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2.5 border-b border-line px-3.5">
              <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search employees, leads, tasks, work logs…"
                className="h-12 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-subtle"
              />
              {isFetching && (
                <span className="size-3 animate-spin rounded-full border-2 border-line border-t-tomato" />
              )}
              <kbd className="hidden rounded-sm border border-line bg-elevated px-1 font-mono text-2xs text-ink-subtle sm:block">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-subtle">
                {query ? `Nothing matches "${query}"` : 'Start typing to search'}
              </Command.Empty>

              {matchingPages.length > 0 && (
                <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {matchingPages.map((page) => (
                    <Item key={page.to} onSelect={() => go(page.to)}>
                      <page.icon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
                      {page.label}
                    </Item>
                  ))}
                </Command.Group>
              )}

              {data?.employees.length ? (
                <Command.Group heading="Employees" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {data.employees.map((employee) => (
                    <Item key={employee.id} onSelect={() => go('/employees')}>
                      <span className="truncate">{employee.name}</span>
                      <span className="truncate text-xs text-ink-subtle">{employee.email}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {data?.leads.length ? (
                <Command.Group heading="Leads" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {data.leads.map((lead) => (
                    <Item key={lead.id} onSelect={() => go(`/leads/${lead.id}`)}>
                      <span className="truncate">{lead.company}</span>
                      {lead.contact_name && (
                        <span className="truncate text-xs text-ink-subtle">{lead.contact_name}</span>
                      )}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {data?.tasks.length ? (
                <Command.Group heading="Tasks" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {data.tasks.map((task) => (
                    <Item key={task.id} onSelect={() => go(`/tasks?highlight=${task.id}`)}>
                      <span className="truncate">{task.title}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {data?.workLogs.length ? (
                <Command.Group heading="Work logs" className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {data.workLogs.map((log) => (
                    <Item key={log.id} onSelect={() => go(`/work-logs?highlight=${log.id}`)}>
                      <span className="truncate">{log.project}</span>
                      <span className="truncate text-xs text-ink-subtle">{log.task}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-base text-ink-muted',
        'data-[selected=true]:bg-elevated data-[selected=true]:text-ink',
      )}
    >
      {children}
      <CornerDownLeft
        className="ml-auto size-3 shrink-0 opacity-0 [[data-selected=true]_&]:opacity-40"
        aria-hidden
      />
    </Command.Item>
  )
}
