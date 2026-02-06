import { PrivyProvider } from '@privy-io/react-auth';
import WalletExport from './WalletExport';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

export default function App() {
  if (!PRIVY_APP_ID) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#111',
        color: '#eee',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
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
  );
}
