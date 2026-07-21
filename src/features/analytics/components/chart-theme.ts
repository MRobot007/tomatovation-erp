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
    // On-glass values throughout: the chart is drawn on a dark pane, so the
    // series need the lifted hues and the accent needs its white expression.
    // Fallbacks must track tokens.css by hand.
    brand: cssVar('--og-brand', 'hsl(210 16% 95%)'),
    success: cssVar('--og-success', 'hsl(152 45% 58%)'),
    warning: cssVar('--og-warning', 'hsl(45 75% 62%)'),
    danger: cssVar('--og-danger', 'hsl(356 70% 68%)'),
    info: cssVar('--og-info', 'hsl(212 55% 68%)'),
    // Every chart lives inside a glass card, and a glass card flips its
    // content tokens to light-on-dark. These read the on-glass values off the
    // root because getComputedStyle here cannot see a card's cascade — read
    // the plain --ink and the axes would be near-black on a near-black pane.
    ink: cssVar('--og-ink', 'hsl(210 16% 96%)'),
    inkMuted: cssVar('--og-ink-muted', 'hsl(214 10% 73%)'),
    inkSubtle: cssVar('--og-ink-subtle', 'hsl(214 9% 57%)'),
    line: cssVar('--og-line', 'hsl(214 12% 32%)'),
    surface: cssVar('--og-surface', 'hsl(220 12% 17%)'),
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
