import type { ReactNode } from 'react'
import { logoLockup } from '@/lib/logo'

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
              className="flex size-8 items-center justify-center rounded bg-brand font-display text-md font-bold text-primary-foreground shadow-sm"
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
      {/* The same machined metal as the rail, at panel scale: a light source
          off the top-left, falling away to near-black. A flat dark rectangle
          next to warm paper reads as a missing image. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 95% at 14% 6%, hsl(220 10% 26%) 0%, hsl(220 11% 14%) 42%, hsl(220 13% 6%) 100%)',
        }}
        aria-hidden
      />
      {/* Brush grain, matching the rail. It is what stops a large dark field
          from looking like an empty div at this size. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, hsl(210 30% 100% / 0.02) 0px, hsl(210 30% 100% / 0.02) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden
      />
      <div className="grain absolute inset-0" aria-hidden />

      <div className="relative p-10">
        {/* The full white lockup, at last on the dark panel that was built for
            it. The drop shadow lifts it a hair off the metal. */}
        <img
          src={logoLockup}
          alt="Tomatovation"
          className="w-48 select-none drop-shadow-[0_2px_8px_hsl(0_0%_0%/0.4)]"
          draggable={false}
        />
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
              {/* Was text-brand — but --brand is graphite in the light theme,
                  and this panel is always dark, so the labels were near-black
                  on near-black and effectively invisible. White on the panel,
                  with the detail one step dimmer for hierarchy. */}
              <p className="font-mono text-sm font-semibold text-white" data-numeric>
                {label}
              </p>
              <p className="text-sm text-white/65">{detail}</p>
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
