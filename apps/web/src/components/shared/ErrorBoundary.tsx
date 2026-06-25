"use client";

import React, { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Future: send to error reporting service (Sentry, etc.)
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-bg-primary text-text-primary gap-4 p-8">
          <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-3xl">
            !
          </div>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-text-muted text-center max-w-md">
            An unexpected error occurred. This has been logged automatically.
          </p>
          {this.state.error && (
            <pre className="text-xs text-text-muted bg-bg-secondary border border-border-custom rounded-xl p-4 max-w-lg overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-bg-secondary border border-border-custom text-text-secondary hover:text-text-primary font-semibold text-sm rounded-xl px-5 py-2.5 cursor-pointer transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
