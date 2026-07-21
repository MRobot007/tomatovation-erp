import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Type scale is deliberately editorial: a tight, dense band for UI/table text
 * (12-15px) and a wide jump to display sizes. That contrast is what stops the
 * app reading like a component-library demo, where everything sits at 14/16/20.
 */
const config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1536px' },
    },
    extend: {
      colors: {
        paper: 'hsl(var(--paper) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        elevated: 'hsl(var(--elevated) / <alpha-value>)',
        sunken: 'hsl(var(--sunken) / <alpha-value>)',

        ink: {
          DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
          muted: 'hsl(var(--ink-muted) / <alpha-value>)',
          subtle: 'hsl(var(--ink-subtle) / <alpha-value>)',
        },

        line: {
          DEFAULT: 'hsl(var(--line) / <alpha-value>)',
          strong: 'hsl(var(--line-strong) / <alpha-value>)',
        },

        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          hover: 'hsl(var(--brand-hover) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
          ink: 'hsl(var(--brand-ink) / <alpha-value>)',
        },

        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          soft: 'hsl(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          soft: 'hsl(var(--danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          soft: 'hsl(var(--info-soft) / <alpha-value>)',
        },

        presence: {
          online: 'hsl(var(--presence-online) / <alpha-value>)',
          working: 'hsl(var(--presence-working) / <alpha-value>)',
          break: 'hsl(var(--presence-break) / <alpha-value>)',
          offline: 'hsl(var(--presence-offline) / <alpha-value>)',
        },

        // shadcn/ui contract — maps onto the palette above.
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },

      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.005em' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.625rem' }],
        xl: ['1.3125rem', { lineHeight: '1.875rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.018em' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.024em' }],
        '4xl': ['3rem', { lineHeight: '3.125rem', letterSpacing: '-0.03em' }],
        // Tabular label used above metric numbers and table group headers.
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.09em' }],
      },

      borderRadius: {
        // Tight, printed-feel radii. Uniform 8px everywhere is a template tell.
        sm: '0.1875rem',
        DEFAULT: '0.3125rem',
        md: '0.3125rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },

      spacing: {
        // Named rhythm steps so density decisions are explicit, not ad-hoc.
        gutter: '1.5rem',
        section: '2.5rem',
        'row-sm': '2rem',
        row: '2.75rem',
        'row-lg': '3.25rem',
        sidebar: '15rem',
        'sidebar-collapsed': '3.5rem',
        topbar: '3.5rem',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        // Indeterminate progress: a short bar that sweeps the rail and eases
        // at each end, so it reads as "still working" rather than a metronome.
        'loader-slide': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(360%)' },
        },
        // The logo chip breathing on the boot screen.
        'logo-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.04)', opacity: '0.9' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.18s ease-out',
        'accordion-up': 'accordion-up 0.18s ease-out',
        'fade-in': 'fade-in 0.18s ease-out',
        'rise-in': 'rise-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'loader-slide': 'loader-slide 1.15s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'logo-breathe': 'logo-breathe 2.4s ease-in-out infinite',
      },

      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config

export default config
