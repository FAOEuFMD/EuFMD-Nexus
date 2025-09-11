import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  dataKey?: string; // Optional key to track data changes
}

interface State {
  hasError: boolean;
  error?: Error;
  errorKey?: string;
}

/**
 * A safety wrapper specifically designed for Nivo charts that handles
 * the "Cannot add property ref, object is not extensible" error
 */
class SafeNivoWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('SafeNivoWrapper caught an error:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SafeNivoWrapper error details:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      props: this.props.dataKey
    });
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if data changes (new attempt with different data)
    if (this.state.hasError && prevProps.dataKey !== this.props.dataKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded border border-gray-200">
            <div className="text-center p-4">
              <div className="mb-2">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-2 text-sm">Chart visualization temporarily unavailable</p>
              <p className="text-xs text-gray-500 mb-3">
                {this.state.error?.message.includes('extensible') 
                  ? 'Data format compatibility issue detected' 
                  : 'Chart rendering error occurred'}
              </p>
              <button
                onClick={this.handleRetry}
                className="px-3 py-1 bg-[#15736d] text-white text-sm rounded hover:bg-[#0f5a54] transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default SafeNivoWrapper;
