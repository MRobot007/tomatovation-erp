import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

/**
 * A credential shown once, with a copy button.
 *
 * `select-all` and `break-all` matter more than they look: these values are
 * read off the screen and pasted into a chat window, and a password that wraps
 * mid-character or selects only half of itself gets sent wrong.
 */
export function CopyRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is unavailable over plain http or without permission; the
      // value is on screen and selectable either way.
    }
  }

  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            'flex-1 select-all break-all rounded border border-line bg-sunken/50 px-2.5 py-2 text-sm text-ink',
            mono && 'font-mono',
          )}
        >
          {value}
        </code>
        <Button type="button" variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={copy}>
          {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
