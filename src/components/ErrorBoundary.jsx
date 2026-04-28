import { Component } from 'react';

// React Error Boundary — catches errors thrown anywhere in the
// child component tree and renders a fallback UI instead of the
// blank-white-screen-of-death.
//
// We deliberately keep the fallback simple: tell the user something
// went wrong, give them a reload button, and offer to clear local
// data if reload doesn't help. This is the floor of resilience —
// the app should still recover gracefully even if something
// unexpected throws.
//
// React only supports error boundaries via class components; there
// is no useErrorBoundary hook. Hence the class.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log to console so developers can diagnose; user sees only the
    // friendly fallback UI below.
    console.error('Error boundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearData = () => {
    if (window.confirm('This will erase all local progress and settings. Continue?')) {
      try {
        localStorage.clear();
      } catch {
        // localStorage may itself be the problem; ignore failure
      }
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          background: '#f5f5f5',
          color: '#1f1f1f',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
          gap: '1rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: '32rem', margin: 0, color: '#555', lineHeight: 1.5 }}>
          The app encountered an unexpected error. Try reloading first.
          If the error persists, you can clear local data — this will
          erase your progress and settings.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.7rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              background: '#7C3AED',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
          <button
            onClick={this.handleClearData}
            style={{
              padding: '0.7rem 1.4rem',
              borderRadius: '8px',
              border: '1px solid #d4d4d4',
              background: '#fff',
              color: '#1f1f1f',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear local data
          </button>
        </div>
        {this.state.error?.message && (
          <details style={{ maxWidth: '32rem', marginTop: '1rem', color: '#888', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '0.5rem' }}>
              {this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
