import type { ReactNode } from 'react'

/**
 * Split composition: an editorial brand panel on the left, the form on the
 * right. The panel is what stops the sign-in screen reading as a generic
 * centred card, and it collapses away entirely under lg so the form gets the
 * full width on a phone.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      <div className="grain flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <div
              className="flex size-8 items-center justify-center rounded bg-tomato font-display text-md font-bold text-primary-foreground shadow-sm"
              aria-hidden
            >
              T
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              Tomatovation
            </span>
          </div>

          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {description && <p className="mt-2 text-md text-ink-muted">{description}</p>}

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between">
      {/* Warm wash rather than a flat fill — a solid dark rectangle next to warm
          paper reads as a missing image. */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 8%, hsl(9 61% 30%) 0%, hsl(14 35% 14%) 45%, hsl(36 16% 8%) 100%)',
        }}
        aria-hidden
      />
      <div className="grain absolute inset-0" aria-hidden />

      <div className="relative p-10">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded bg-tomato font-display text-md font-bold text-white shadow-sm"
            aria-hidden
          >
            T
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white/95">
            Tomatovation
          </span>
        </div>
      </div>

      <div className="relative max-w-lg p-10">
        <p className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-white/95">
          Attendance, work logs, leave and the sales pipeline — in one place your team actually
          opens every morning.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {[
            ['One tap', 'Punch in and out'],
            ['Real time', 'Team presence'],
            ['One trail', 'Every change audited'],
          ].map(([label, detail]) => (
            <div key={label}>
              <p className="font-mono text-sm font-medium text-tomato" data-numeric>
                {label}
              </p>
              <p className="text-sm text-white/55">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative p-10">
        <p className="text-xs text-white/35">
          Internal system. Access is scoped to your role and logged.
        </p>
      </div>
    </div>
  )
}
