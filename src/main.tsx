import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found in index.html')

/**
 * The app is imported dynamically inside a try/catch.
 *
 * A module-level throw — a misconfigured environment variable being the likely
 * one — otherwise aborts the whole module graph before React mounts. The result
 * is a blank white page: no UI, and in a production build not even a console
 * message, because the rejection happens inside the module loader. That is the
 * worst failure mode an app can have, because it looks identical to a hosting
 * problem and sends you looking in the wrong place.
 *
 * Catching it here turns any boot failure into something readable on screen.
 */
async function boot() {
  const root = createRoot(container!)

  try {
    const { default: App } = await import('./App')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The application failed to start.'
    root.render(<BootError message={message} />)
    // Re-log so the stack is still available in devtools.
    console.error('Application failed to start:', error)
  }
}

function BootError({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        // Inline styles on purpose: the stylesheet may itself be the thing that
        // failed, and this screen has to render regardless.
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: 'hsl(42 33% 97%)',
        color: 'hsl(36 12% 9%)',
      }}
    >
      <div style={{ maxWidth: '32rem' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'hsl(4 62% 44%)',
            margin: '0 0 0.5rem',
          }}
        >
          Configuration error
        </p>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
          The app could not start
        </h1>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            background: 'hsl(42 22% 91%)',
            border: '1px solid hsl(42 20% 87%)',
            borderRadius: '0.3125rem',
            padding: '0.75rem',
            margin: '0 0 1rem',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {message}
        </pre>
        <p style={{ fontSize: '0.875rem', color: 'hsl(37 11% 39%)', margin: 0 }}>
          If this is a deployed build, check that <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> are set in your hosting provider&rsquo;s environment
          variables, then redeploy — Vite bakes these in at build time, so adding them afterwards
          has no effect until the next build.
        </p>
      </div>
    </div>
  )
}

void boot()
