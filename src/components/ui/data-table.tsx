import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
import { TableSkeleton } from './skeleton'
import { EmptyState, ErrorState } from './states'
import type { SortState } from '@/hooks/use-search-param-state'
import { cn } from '@/lib/utils'

export interface Column<T> {
  /** Stable key; also the sort key sent to the server when `sortable`. */
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  /** Right-align numeric columns so digits line up down the column. */
  numeric?: boolean
  className?: string
  headClassName?: string
}

interface DataTableProps<T> {
  columns: ReadonlyArray<Column<T>>
  rows: readonly T[] | undefined
  rowKey: (row: T) => string
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  sort?: SortState
  onSort?: (columnId: string) => void
  onRowClick?: (row: T) => void
  empty?: { title: string; description?: string; action?: ReactNode }
  /** Rendered right-aligned on row hover — edit, delete, and similar. */
  rowActions?: (row: T) => ReactNode
}

/**
 * One table component for every list in the app, so loading, empty and error
 * states are consistent by construction rather than by discipline. Sorting is
 * delegated upward because it lives in the URL and is applied by the database,
 * not by re-sorting a page of rows in the browser.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  sort,
  onSort,
  onRowClick,
  empty,
  rowActions,
}: DataTableProps<T>) {
  if (error) {
    return (
      <TableContainer>
        <ErrorState error={error} onRetry={onRetry} />
      </TableContainer>
    )
  }

  if (isLoading) {
    return (
      <TableContainer>
        <TableSkeleton rows={8} columns={columns.length} />
      </TableContainer>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <TableContainer>
        <EmptyState
          title={empty?.title ?? 'Nothing here yet'}
          description={empty?.description}
          action={empty?.action}
        />
      </TableContainer>
    )
  }

  return (
    <TableContainer className="max-h-[calc(100dvh-16rem)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(column.numeric && 'text-right', column.headClassName)}
                aria-sort={
                  sort?.column === column.id
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {column.sortable && onSort ? (
                  <button
                    onClick={() => onSort(column.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-ink',
                      column.numeric && 'flex-row-reverse',
                      sort?.column === column.id && 'text-ink',
                    )}
                  >
                    {column.header}
                    <SortIcon active={sort?.column === column.id} direction={sort?.direction} />
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
            {rowActions && <TableHead className="w-px" />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(column.numeric && 'text-right font-mono', column.className)}
                  data-numeric={column.numeric || undefined}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
              {rowActions && (
                <TableCell className="w-px pr-2">
                  {/* Revealed on hover, but always present for keyboard and
                      screen-reader users — focus-within keeps it visible when
                      tabbed into. */}
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {rowActions(row)}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function SortIcon({ active, direction }: { active?: boolean; direction?: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-40" aria-hidden />
  return direction === 'asc' ? (
    <ArrowUp className="size-3" aria-hidden />
  ) : (
    <ArrowDown className="size-3" aria-hidden />
  )
}
