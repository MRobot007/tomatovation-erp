import { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateDepartment, useDepartments } from '../hooks/use-departments'

/** Sentinel values. Real names cannot collide — both are impossible department names. */
const NONE = '__none__'
const ADD = '__add__'

/**
 * Department picker with an inline "add new" row.
 *
 * Inline rather than a second dialog on purpose: this control is used inside
 * the Add-employee dialog, and stacking a Radix dialog on a dialog fights over
 * focus and dismissal in ways that are not worth it for one text field.
 *
 * Adding is restricted to managers and super admins by RLS. The option is shown
 * to everyone rather than hidden by role, because the guard that matters is the
 * database one, and hiding it here would mean re-deriving the same rule in a
 * second place where it could drift.
 */
export function DepartmentSelect({
  value,
  onChange,
  id,
}: {
  /** The department name, or null for none. */
  value: string | null
  onChange: (value: string | null) => void
  id?: string
}) {
  const { data: departments, isLoading } = useDepartments()
  const create = useCreateDepartment()

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startAdding() {
    setDraft('')
    create.reset()
    setAdding(true)
    // After the select closes and this swaps in. Without the delay the input
    // is not mounted yet and focus goes nowhere.
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function commit() {
    const name = draft.trim()
    if (!name) return

    // Already in the list: select it rather than reporting a duplicate. From
    // here "add Marketing" and "pick Marketing" are the same intent.
    const existing = (departments ?? []).find(
      (department) => department.name.toLowerCase() === name.toLowerCase(),
    )
    if (existing) {
      onChange(existing.name)
      setAdding(false)
      return
    }

    const created = await create.mutateAsync(name)
    onChange(created.name)
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="New department name"
            maxLength={80}
            aria-label="New department name"
            onKeyDown={(event) => {
              // Enter must not submit the surrounding employee form — the
              // person is naming a department, not saving the employee.
              if (event.key === 'Enter') {
                event.preventDefault()
                void commit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setAdding(false)
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="icon"
            aria-label="Add department"
            loading={create.isPending}
            disabled={draft.trim() === ''}
            onClick={() => void commit()}
          >
            <Check aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Cancel adding a department"
            onClick={() => setAdding(false)}
          >
            <X aria-hidden />
          </Button>
        </div>

        {create.error && (
          <p className="text-sm text-danger">{(create.error as Error).message}</p>
        )}
      </div>
    )
  }

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => {
        if (next === ADD) {
          startAdding()
          return
        }
        onChange(next === NONE ? null : next)
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={isLoading ? 'Loading…' : 'No department'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No department</SelectItem>

        {(departments ?? []).map((department) => (
          <SelectItem key={department.id} value={department.name}>
            {department.name}
          </SelectItem>
        ))}

        <SelectSeparator />
        <SelectItem value={ADD}>
          <span className="flex items-center gap-2 text-brand">
            <Plus className="size-3.5" aria-hidden />
            New department
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
