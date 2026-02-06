import { PrivyProvider } from '@privy-io/react-auth';
import { Component } from 'react';
import WalletExport from './WalletExport';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#111', color: '#eee',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ maxWidth: 600 }}>
            <h1>Privy Initialization Error</h1>
            <p style={{ color: '#e74c3c' }}>{this.state.error.message || String(this.state.error)}</p>
            <p style={{ color: '#aaa', lineHeight: 1.6 }}>
              This usually means the deployed domain is not in Privy's allowed origins.
              Make sure <code>https://privy-wallet-recovery.vercel.app</code> is added as an
              allowed domain in the Privy dashboard.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#6c5ce7', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', marginTop: 10 }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  if (!PRIVY_APP_ID) {
    return (
      <div style={{
        minHeight: '100vh', background: '#111', color: '#eee',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 600 }}>
          <h1>Missing Privy App ID</h1>
          <p>Set <code>VITE_PRIVY_APP_ID</code> in your <code>.env</code> file and restart the dev server.</p>
          <pre style={{ background: '#222', padding: 16, borderRadius: 8 }}>VITE_PRIVY_APP_ID=your_app_id_here</pre>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'apple', 'twitter'],
          appearance: {
            theme: 'dark',
          },
          embeddedWallets: {
            createOnLogin: 'off',
          },
        }}
      >
        <WalletExport />
      </PrivyProvider>
    </ErrorBoundary>
  );
}
