'use client';

import { Component, Fragment, type ReactNode } from 'react';
import { ErrorFallback } from '@/components/finzen/ui/error-fallback';
import { useViewNavigation } from '@/hooks/use-view-navigation';
import { reportError } from '@/lib/finzen/error-report';

interface ViewErrorBoundaryProps {
  children: ReactNode;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  resetKey: number;
}

function ViewBoundaryFallback({ onRetry }: { onRetry: () => void }) {
  const navigate = useViewNavigation();

  return (
    <ErrorFallback
      onRetry={onRetry}
      onDashboard={() => navigate('dashboard')}
    />
  );
}

/**
 * Contenedor de errores de render/lifecycle de la vista activa.
 *
 * No intercepta event handlers ni callbacks async: esos errores siguen el
 * flujo `try/catch` + toast de la acción que los origine.
 */
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): ViewErrorBoundaryState {
    return { hasError: true, resetKey: 0 };
  }

  componentDidCatch(error: Error): void {
    reportError('view', error);
  }

  reset = (): void => {
    this.setState((state) => ({ hasError: false, resetKey: state.resetKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ViewBoundaryFallback onRetry={this.reset} />;
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
