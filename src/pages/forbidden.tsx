import { Link } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-lg border border-danger/25 bg-danger-soft text-danger">
        <ShieldX className="size-6" aria-hidden />
      </div>
      <p className="eyebrow mb-2">403</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        You do not have access to this
      </h1>
      <p className="mt-2 max-w-md text-md text-ink-muted">
        Your role does not include this screen. If you believe that is wrong, ask a super admin to
        review your permissions — the change takes effect on your next page load.
      </p>
      <Button variant="primary" className="mt-6" asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-2">404</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        That page does not exist
      </h1>
      <p className="mt-2 max-w-md text-md text-ink-muted">
        The link may be out of date, or the record may have been removed.
      </p>
      <Button variant="primary" className="mt-6" asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}
