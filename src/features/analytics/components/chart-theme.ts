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

/**
 * Axes carry the scale and then get out of the way.
 *
 * No axis line and no tick marks: on a dark pane those draw a bright box
 * around the data, and the horizontal grid already tells you where the values
 * sit. The labels keep tabular figures so the y-axis does not shuffle
 * sideways by a pixel every time a digit changes.
 */
export function axisProps(colors: ReturnType<typeof chartColors>) {
  return {
    tick: {
      fill: colors.inkSubtle,
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif',
      style: { fontVariantNumeric: 'tabular-nums' as const },
    },
    tickLine: false,
    axisLine: false as const,
    tickMargin: 8,
    minTickGap: 12,
  }
}

/**
 * Grid: horizontal only, dashed, and faint.
 *
 * A full grid at full strength competes with the series it is supposed to
 * support. Vertical lines are dropped entirely — on a time axis they repeat
 * information the x labels already carry.
 */
export function gridProps(colors: ReturnType<typeof chartColors>) {
  return {
    stroke: colors.line,
    strokeOpacity: 0.16,
    strokeDasharray: '2 6',
    vertical: false,
  }
}

export function tooltipProps(colors: ReturnType<typeof chartColors>) {
  return {
    // The hover guide, styled rather than left as the default grey block that
    // covers the very column you are trying to read.
    cursor: { stroke: colors.inkSubtle, strokeOpacity: 0.35, strokeWidth: 1 },
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: '0.5rem',
      fontSize: '0.8125rem',
      padding: '0.625rem 0.75rem',
      // Opaque and lifted. A translucent tooltip over a chart is unreadable
      // exactly when it matters — sitting on top of the data.
      boxShadow: '0 8px 24px -8px hsl(220 40% 2% / 0.7), 0 2px 6px -2px hsl(220 40% 2% / 0.5)',
    },
    labelStyle: {
      color: colors.ink,
      fontWeight: 600,
      marginBottom: '0.375rem',
      fontFamily: 'Space Grotesk, Inter, sans-serif',
    },
    itemStyle: { color: colors.inkMuted, padding: '0.0625rem 0' },
  }
}

export function legendProps(colors: ReturnType<typeof chartColors>) {
  return {
    wrapperStyle: {
      fontSize: 12,
      color: colors.inkMuted,
      paddingTop: 12,
    },
    iconType: 'circle' as const,
    iconSize: 7,
  }
}

/**
 * Series draw themselves in on mount, left to right.
 *
 * 700ms is long enough to read as the data arriving and short enough that
 * nobody waits for it. Applied per series with a stagger where a chart has
 * more than one, so they resolve in sequence rather than racing.
 *
 * The global prefers-reduced-motion rule cannot reach these — Recharts
 * animates in JS, not CSS — so the check is explicit.
 */
export function seriesAnimation(index = 0) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return {
    isAnimationActive: !reduced,
    animationDuration: 700,
    animationBegin: index * 120,
    animationEasing: 'ease-out' as const,
  }
}
