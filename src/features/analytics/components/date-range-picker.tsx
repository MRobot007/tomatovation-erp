import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSearchParamState } from '@/hooks/use-search-param-state'

export const PRESETS = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'This month',
  ytd: 'This year',
} as const

export type Preset = keyof typeof PRESETS

function isoDate(date: Date): string {
  // Local components, not toISOString(): the latter converts to UTC first and
  // can land on the previous day for anyone east of Greenwich.
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rangeFor(preset: Preset): { from: string; to: string } {
  const today = new Date()
  const to = isoDate(today)

  if (preset === 'mtd') {
    return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
  if (preset === 'ytd') {
    return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to }
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  return { from: isoDate(start), to }
}

/** Range lives in the URL, so a report view is a shareable link. */
export function useDateRange() {
  const [preset, setPreset] = useSearchParamState<Preset>('range', '30d')
  const { from, to } = useMemo(() => rangeFor(preset), [preset])
  return { preset, setPreset, from, to }
}

export function DateRangePicker({
  preset,
  onPresetChange,
}: {
  preset: Preset
  onPresetChange: (preset: Preset) => void
}) {
  return (
    <Select value={preset} onValueChange={(value) => onPresetChange(value as Preset)}>
      <SelectTrigger className="w-auto min-w-36" aria-label="Date range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PRESETS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
