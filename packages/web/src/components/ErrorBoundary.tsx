import { Component, type ErrorInfo, type ReactNode } from 'react';
import { api } from '../api/client';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void api.reportClientError({
      message: error.message,
      stack: error.stack ?? null,
      component: info.componentStack?.trim().split('\n')[0] ?? null,
      url: window.location.href,
    });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-panel">
          <h2>Something went wrong</h2>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
