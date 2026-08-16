import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

/**
 * Last line of defence. The legacy modules mutate the DOM underneath React and
 * use non-null assertions on `getElementById`; if a contract element is ever
 * missing they throw. Without a boundary that blanks the whole app.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-red/40 bg-accent-red/10 font-mono text-2xl text-accent-red">
          !
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-content-primary">
            The interface crashed
          </h1>
          <p className="mt-2 max-w-md text-sm text-content-secondary">
            {error.message || 'An unexpected error occurred while rendering this screen.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Dismiss
          </Button>
          <Button onClick={() => window.location.reload()}>Reload app</Button>
        </div>
      </div>
    );
  }
}
