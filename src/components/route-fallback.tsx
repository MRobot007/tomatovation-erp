import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown while a lazily-loaded route chunk downloads. Mirrors the page-header
 * plus table rhythm every screen uses, so the layout does not jump when the
 * real content lands. A centred spinner would reflow the entire page.
 */
export function RouteFallback() {
  return (
    <div className="animate-fade-in" role="status" aria-label="Loading page">
      <div className="mb-6">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="mt-2.5 h-7 w-52" />
        <Skeleton className="mt-3 h-3 w-96 max-w-full" />
        <div className="rule mt-5" />
      </div>

      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="h-9 border-b border-line bg-elevated/60" />
        <div className="divide-y divide-line">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-row items-center gap-4 px-4">
              <Skeleton className="h-3 w-[18%]" />
              <Skeleton className="h-3 w-[12%]" />
              <Skeleton className="h-3 w-[20%]" />
              <Skeleton className="h-3 w-[10%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
