import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showErrorDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showErrorDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showErrorDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">System Error</h2>
            <p className="text-gray-600 mb-6">
              A system error has occurred. Please report this to your coordinator so we can fix it.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
              >
                Reload Page
              </button>

              <button
                onClick={() => this.setState(prev => ({ showErrorDetails: !prev.showErrorDetails }))}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors cursor-pointer"
              >
                {this.state.showErrorDetails ? 'Hide Error Details' : 'View Error'}
              </button>
            </div>

            {this.state.showErrorDetails && this.state.error && (
              <div className="mt-6 text-left">
                <div className="bg-gray-900 rounded-xl p-4 overflow-auto max-h-60">
                  <p className="text-red-400 font-mono text-sm mb-2">{this.state.error.toString()}</p>
                  <pre className="text-gray-400 font-mono text-xs whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
