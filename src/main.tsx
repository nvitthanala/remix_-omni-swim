import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 720,
            margin: '48px auto',
            color: '#fecaca',
            background: '#1c1917',
            borderRadius: 8,
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#e7e5e4' }}>
            {this.state.error.stack || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Missing #root element.</p>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>
  );
}
