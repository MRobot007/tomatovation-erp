/**
 * Chart colours resolved from the design tokens at runtime rather than
 * hardcoded hex. Recharts needs concrete colour strings, so reading the CSS
 * variables keeps the charts in step with the palette — including the switch
 * between light and dark, which a hardcoded value would ignore.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value ? `hsl(${value})` : fallback
}

export function chartColors() {
  return {
    // Fallbacks must track tokens.css. They were left on the old orange after
    // the palette went achromatic, which would have put a stripe of the
    // retired brand colour back on any chart that rendered before the
    // stylesheet resolved — the one place it could still appear.
    brand: cssVar('--brand', 'hsl(220 14% 16%)'),
    success: cssVar('--success', 'hsl(152 39% 30%)'),
    warning: cssVar('--warning', 'hsl(45 68% 36%)'),
    danger: cssVar('--danger', 'hsl(356 60% 45%)'),
    info: cssVar('--info', 'hsl(212 37% 37%)'),
    ink: cssVar('--ink', 'hsl(36 12% 9%)'),
    inkMuted: cssVar('--ink-muted', 'hsl(37 11% 39%)'),
    inkSubtle: cssVar('--ink-subtle', 'hsl(38 10% 55%)'),
    line: cssVar('--line', 'hsl(42 20% 87%)'),
    surface: cssVar('--surface', 'hsl(40 40% 99%)'),
  }
}

/**
 * Categorical sequence for multi-series charts. Ordered so adjacent series stay
 * distinguishable in greyscale and to the most common colour-vision
 * deficiencies — not simply "the palette in declaration order".
 */
export function categoricalPalette(): string[] {
  const colors = chartColors()
  return [colors.brand, colors.info, colors.success, colors.warning, colors.danger, colors.inkMuted]
}

export function axisProps(colors: ReturnType<typeof chartColors>) {
  return {
    stroke: colors.line,
    tick: { fill: colors.inkSubtle, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: colors.line },
  }
}

export function tooltipProps(colors: ReturnType<typeof chartColors>) {
  return {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: '0.5rem',
      fontSize: '0.8125rem',
      boxShadow: '0 4px 12px -4px hsl(30 25% 20% / 0.12)',
    },
    labelStyle: { color: colors.ink, fontWeight: 600, marginBottom: '0.25rem' },
    itemStyle: { color: colors.inkMuted },
  }
}
