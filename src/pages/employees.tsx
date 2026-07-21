import { useState } from 'react'
import { KeyRound, Pencil, Plus, Search, UserCheck, UserX, Users } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmployeeEditDialog } from '@/features/employees/components/employee-edit-dialog'
import { CreateEmployeeDialog } from '@/features/employees/components/create-employee-dialog'
import { ResetPasswordDialog } from '@/features/employees/components/reset-password-dialog'
import { useDepartments } from '@/features/departments/hooks/use-departments'
import {
  useEmployees,
  useSetEmployeeStatus,
} from '@/features/employees/hooks/use-employees'
import type { EmployeeRow } from '@/features/employees/api/employees.api'
import { useSearchParamState, useSortParam } from '@/hooks/use-search-param-state'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { useDebounced } from '@/hooks/use-debounced'

const ROLE_TONE = {
  super_admin: 'brand',
  manager: 'info',
  employee: 'neutral',
} as const

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
} as const

export function EmployeesPage() {
  // Every filter lives in the URL, so a filtered roster is a shareable link.
  const [search, setSearch] = useSearchParamState('q', '')
  const [role, setRole] = useSearchParamState<Role | 'all'>('role', 'all')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const [department, setDepartment] = useSearchParamState('dept', 'all')
  const { sort, toggleSort } = useSortParam('name')

  // Debounced so typing does not fire a query per keystroke; the URL still
  // updates immediately so the address bar tracks what was typed.
  const debouncedSearch = useDebounced(search, 300)

  const { data: departments } = useDepartments()
  const { data, isLoading, error, refetch } = useEmployees({
    search: debouncedSearch,
    role,
    status: status as never,
    department,
    sortColumn: sort.column,
    sortDirection: sort.direction,
  })

  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deactivating, setDeactivating] = useState<EmployeeRow | null>(null)
  const [resettingPassword, setResettingPassword] = useState<EmployeeRow | null>(null)
  const setEmployeeStatus = useSetEmployeeStatus()

  const columns: ReadonlyArray<Column<EmployeeRow>> = [
    {
      id: 'name',
      header: 'Employee',
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={row.name} src={row.profile_photo} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.name}</p>
            <p className="truncate text-xs text-ink-subtle">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      sortable: true,
      cell: (row) => <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABELS[row.role]}</Badge>,
    },
    {
      id: 'department',
      header: 'Department',
      sortable: true,
      cell: (row) => row.department ?? <span className="text-ink-subtle">—</span>,
    },
    {
      id: 'manager',
      header: 'Reports to',
      cell: (row) => row.manager?.name ?? <span className="text-ink-subtle">—</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]} dot>
          {row.status[0]!.toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
  ]

  const activeFilters = [role, status, department].filter((value) => value !== 'all').length

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="Roles and reporting lines set here drive every permission in the system."
        actions={
          <>
            <Badge tone="neutral">
              {data?.length ?? 0} {data?.length === 1 ? 'person' : 'people'}
            </Badge>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Add employee
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or department"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>

        <FilterSelect
          value={role}
          onChange={(value) => setRole(value as Role | 'all')}
          placeholder="All roles"
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'super_admin', label: 'Super Admin' },
            { value: 'manager', label: 'Manager' },
            { value: 'employee', label: 'Employee' },
          ]}
        />

        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />

        <FilterSelect
          value={department}
          onChange={setDepartment}
          placeholder="All departments"
          options={[
            { value: 'all', label: 'All departments' },
            ...(departments ?? []).map((d) => ({ value: d.name, label: d.name })),
          ]}
        />

        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRole('all')
              setStatus('all')
              setDepartment('all')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        sort={sort}
        onSort={toggleSort}
        onRowClick={setEditing}
        empty={{
          title: search || activeFilters ? 'No one matches those filters' : 'No employees yet',
          description: search || activeFilters
            ? 'Try a broader search or clear the filters.'
            : 'People appear here once they sign up.',
        }}
        rowActions={(row) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.name}`}
              onClick={(event) => {
                event.stopPropagation()
                setEditing(row)
              }}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reset ${row.name}'s password`}
              onClick={(event) => {
                event.stopPropagation()
                setResettingPassword(row)
              }}
            >
              <KeyRound aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={row.status === 'active' ? `Deactivate ${row.name}` : `Reactivate ${row.name}`}
              onClick={(event) => {
                event.stopPropagation()
                if (row.status === 'active') setDeactivating(row)
                else void setEmployeeStatus.mutate({ id: row.id, status: 'active' })
              }}
            >
              {row.status === 'active' ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
            </Button>
          </>
        )}
      />

      <CreateEmployeeDialog open={creating} onOpenChange={setCreating} />

      <EmployeeEditDialog
        employee={editing}
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ResetPasswordDialog
        employee={resettingPassword}
        open={resettingPassword != null}
        onOpenChange={(open) => !open && setResettingPassword(null)}
      />

      <ConfirmDialog
        open={deactivating != null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name}?`}
        description="They will be signed out of the app and blocked from signing back in. Their attendance, work logs and history are kept intact, and you can reactivate them at any time."
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          if (deactivating) {
            await setEmployeeStatus.mutateAsync({ id: deactivating.id, status: 'inactive' })
          }
        }}
      />
    </>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-36" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { Users }
