import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Table primitives tuned for density. Row height sits at 2.75rem — tall enough
 * to hit comfortably, tight enough that a screen shows ~15 rows without
 * scrolling, which is what makes a roster scannable rather than a slideshow.
 */

const TableContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      // Own scroll container: wide tables must scroll here, never make the page
      // scroll sideways.
      className={cn('relative w-full overflow-auto rounded-lg border border-line bg-surface', className)}
      {...props}
    />
  ),
)
TableContainer.displayName = 'TableContainer'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn('w-full caption-bottom border-collapse text-base', className)} {...props} />
  ),
)
Table.displayName = 'Table'

/** Sticky header — the reason a 200-row roster stays usable while scrolling. */
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('sticky top-0 z-10 bg-elevated/95 backdrop-blur-sm', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-line', className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'group transition-colors duration-100 hover:bg-elevated/60 data-[state=selected]:bg-tomato-soft',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-9 whitespace-nowrap border-b border-line px-3 text-left align-middle',
      'text-eyebrow font-semibold uppercase text-ink-subtle',
      className,
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('h-row px-3 align-middle', className)} {...props} />
))
TableCell.displayName = 'TableCell'

export { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
