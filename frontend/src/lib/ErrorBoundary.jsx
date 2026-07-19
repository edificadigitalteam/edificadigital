import { Component } from 'react'
import { reportClientError } from './logger.js'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportClientError({
      message: error?.message,
      stack: error?.stack ?? info?.componentStack,
      context: 'react-error-boundary',
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            gap: '0.75rem',
          }}
        >
          <div>
            <p>Something went wrong. Please reload the page.</p>
            <p>Ocurrió un error. Por favor, recarga la página.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload / Recargar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
