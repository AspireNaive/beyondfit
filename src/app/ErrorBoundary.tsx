import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'

type Props = { children: ReactNode; fallbackTitle?: string }
type State = { error: Error | null }

/**
 * Last line of defence. A render error in one feature must not blank the whole
 * product — this catches it, keeps the chrome, and offers a way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Replace with the real telemetry sink (App Insights / Sentry) once wired.
    console.error('[BeyondFit] Unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-[60vh] place-items-center px-5">
        <div className="max-w-md text-center">
          <p className="eyebrow">Error</p>
          <h1 className="mt-3 text-4xl">{this.props.fallbackTitle ?? 'This screen hit a snag'}</h1>
          <p className="mt-3 text-sm text-chalk-dim">
            The rest of the app is fine. Reload this section to try again — if it keeps happening,
            the details are in the browser console.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              Go home
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
