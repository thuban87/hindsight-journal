/**
 * Error Boundary
 *
 * React class component that catches render errors and shows
 * a fallback UI with a "Reload" button. Prevents a single
 * component crash from blanking the entire view.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    /** Fallback message to show when an error occurs */
    fallback: string;
    /** Child components to wrap */
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, errorMessage: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, errorMessage: error.message };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('Hindsight ErrorBoundary caught:', error, errorInfo);
    }

    handleReload = (): void => {
        this.setState({ hasError: false, errorMessage: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="hindsight-error-boundary">
                    <p>{this.props.fallback}</p>
                    {this.state.errorMessage && (
                        <p className="hindsight-error-boundary-detail">
                            {this.state.errorMessage}
                        </p>
                    )}
                    <button
                        className="hindsight-error-boundary-btn"
                        onClick={this.handleReload}
                    >
                        Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
