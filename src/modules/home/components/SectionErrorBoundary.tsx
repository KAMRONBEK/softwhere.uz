'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logWarn } from '@/core/logger';

interface Props {
  /** Shown instead of the crashed subtree. */
  fallback: ReactNode;
  /** Logged with the error so the failing section is obvious. */
  label: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Contains a crash (a WebGL context that fails to start, a bad shader, a
 * physics error) to one section or canvas instead of blanking the page.
 * A class because React still has no hook equivalent for error boundaries.
 */
export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logWarn(`Lab: ${this.props.label} crashed`, { message: error.message, stack: info.componentStack }, 'LAB');
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
