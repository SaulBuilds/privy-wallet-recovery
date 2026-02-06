import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { polygon } from 'viem/chains';

// Contract addresses
const USDC_POLYGON = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

// Abstract chain config
const ABSTRACT_RPC = 'https://api.mainnet.abs.xyz';
const abstractClient = createPublicClient({
  chain: { id: 2741, name: 'Abstract', network: 'abstract', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [ABSTRACT_RPC] } } },
  transport: http(ABSTRACT_RPC),
});

// Polygon client
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(),
});

// ABIs
const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);
const AGW_ABI = parseAbi([
  'function k1ListOwners() view returns (address[])',
  'function r1ListOwners() view returns (bytes[])',
]);

async function getUSDCBalance(address) {
  const raw = await polygonClient.readContract({
    address: USDC_POLYGON,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });
  return formatUnits(raw, 6);
}

async function getK1Owners(agwAddress) {
  return await abstractClient.readContract({
    address: agwAddress,
    abi: AGW_ABI,
    functionName: 'k1ListOwners',
  });
}

export default function WalletExport() {
  const { ready, authenticated, user, login, logout, exportWallet } = usePrivy();
  const { wallets } = useWallets();

  const [agwAddress, setAgwAddress] = useState('');
  const [agwSubmitted, setAgwSubmitted] = useState(false);

  // Diagnostic data
  const [embeddedWallet, setEmbeddedWallet] = useState(null);
  const [k1Owners, setK1Owners] = useState(null);
  const [k1Error, setK1Error] = useState(null);
  const [signerBalances, setSignerBalances] = useState(null);
  const [agwBalance, setAgwBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportAttempted, setExportAttempted] = useState(false);

  // Find embedded wallet from Privy
  useEffect(() => {
    if (!wallets || wallets.length === 0) {
      setEmbeddedWallet(null);
      return;
    }
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    setEmbeddedWallet(embedded || null);
  }, [wallets]);

  // Query k1Owners when AGW is submitted
  useEffect(() => {
    if (!agwSubmitted || !agwAddress) return;
    let cancelled = false;
    setK1Owners(null);
    setK1Error(null);

    getK1Owners(agwAddress)
      .then((owners) => { if (!cancelled) setK1Owners(owners); })
      .catch((err) => { if (!cancelled) setK1Error(err.shortMessage || err.message); });

    return () => { cancelled = true; };
  }, [agwAddress, agwSubmitted]);

  // Fetch Polygon USDC balances
  const fetchBalances = useCallback(async () => {
    if (!agwSubmitted || !agwAddress) return;
    setBalanceLoading(true);
    try {
      const agwBal = await getUSDCBalance(agwAddress);
      setAgwBalance(agwBal);

      if (k1Owners && k1Owners.length > 0) {
        const balances = await Promise.all(
          k1Owners.map(async (addr) => ({
            address: addr,
            balance: await getUSDCBalance(addr),
          }))
        );
        setSignerBalances(balances);
      }
    } catch (err) {
      console.error('Balance fetch error:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [agwAddress, agwSubmitted, k1Owners]);

  useEffect(() => {
    if (k1Owners && k1Owners.length > 0 && agwSubmitted) {
      fetchBalances();
    }
  }, [k1Owners, agwSubmitted, fetchBalances]);

  // Try export
  async function handleExport() {
    setExportError(null);
    setExportAttempted(true);
    try {
      if (embeddedWallet) {
        await exportWallet({ address: embeddedWallet.address });
      } else {
        await exportWallet();
      }
    } catch (err) {
      console.error('exportWallet error:', err);
      setExportError(err.message || String(err));
    }
  }

  if (!ready) return <Page><p style={{ color: '#888' }}>Loading Privy...</p></Page>;

  if (!authenticated) {
    return (
      <Page>
        <h1>Find My Fucking Keys Please</h1>
        <p style={{ color: '#aaa', maxWidth: 540, lineHeight: 1.7 }}>
          This tool helps diagnose and recover access to your Abstract Global Wallet (AGW).
          Log in with the <strong>same email/social account</strong> you used to create your Abstract wallet.
        </p>
        <p style={{ color: '#f5a623', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Important: Use the <strong>same browser and device</strong> where you originally created
          your Abstract wallet. Your encryption key shard is stored locally in this browser.
        </p>
        <button onClick={login} style={btnStyle}>
          Log in with Privy
        </button>
      </Page>
    );
  }

  const hasEmbedded = !!embeddedWallet;
  const linkedAccounts = user?.linkedAccounts || [];
  const walletAccounts = linkedAccounts.filter((a) => a.type === 'wallet');
  const hasOriginalWallet = walletAccounts.some(
    (w) => w.walletClientType === 'privy' && k1Owners?.map((a) => a.toLowerCase()).includes(w.address?.toLowerCase())
  );

  return (
    <Page>
      <h1>Find My Fucking Keys Please</h1>

      {/* Account Info */}
      <Section title="1. Your Privy Account">
        <Row label="Logged in as" value={user?.email?.address || user?.google?.email || user?.twitter?.username || 'Connected'} />
        <Row label="Privy User ID" value={user?.id || '—'} mono />
        <Row label="Linked accounts" value={linkedAccounts.map((a) => a.type).join(', ') || 'none'} />
        {walletAccounts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: '#888', fontSize: 13 }}>Linked wallets:</span>
            {walletAccounts.map((w, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: 13, color: '#6c5ce7', marginTop: 4 }}>
                {w.address} <span style={{ color: '#888' }}>[{w.walletClientType}]</span>
              </div>
            ))}
          </div>
        )}
        {walletAccounts.length === 0 && (
          <div style={{ background: '#2a1a00', border: '1px solid #f5a623', borderRadius: 8, padding: 12, marginTop: 10 }}>
            <p style={{ color: '#f5a623', margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              No embedded wallet found in your Privy account. This usually means you're on a
              different browser/device than where you originally created your Abstract wallet.
              The encryption key shard is stored locally and may not be available here.
            </p>
          </div>
        )}
        <button onClick={logout} style={{ ...btnSmall, marginTop: 12 }}>Log out</button>
      </Section>

      {/* AGW Address Input */}
      <Section title="2. Your Abstract Global Wallet">
        <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          Enter your AGW smart contract address (from Abstract portal or abscan.org).
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="0x..."
            value={agwAddress}
            onChange={(e) => { setAgwAddress(e.target.value); setAgwSubmitted(false); }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => setAgwSubmitted(true)}
            disabled={!agwAddress || agwAddress.length < 42}
            style={{ ...btnStyle, opacity: agwAddress.length >= 42 ? 1 : 0.4, whiteSpace: 'nowrap' }}
          >
            Look Up
          </button>
        </div>

        {agwSubmitted && k1Error && (
          <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 10 }}>
            Error querying AGW: {k1Error}
          </p>
        )}

        {agwSubmitted && k1Owners && (
          <div style={{ marginTop: 14 }}>
            <h3 style={{ color: '#2ecc71', fontSize: 14, margin: '0 0 8px' }}>
              AGW Found on Abstract Chain
            </h3>
            <Row label="AGW Contract" value={agwAddress} mono />
            <div style={{ marginTop: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>Authorized EOA Signer(s) (k1Owners):</span>
              {k1Owners.map((addr, i) => (
                <div key={i} style={{
                  fontFamily: 'monospace', fontSize: 14, color: '#2ecc71',
                  fontWeight: 600, marginTop: 4, wordBreak: 'break-all',
                }}>
                  {addr}
                </div>
              ))}
            </div>
            {hasOriginalWallet && (
              <div style={{ background: '#0a2a0a', border: '1px solid #2ecc71', borderRadius: 8, padding: 12, marginTop: 10 }}>
                <p style={{ color: '#2ecc71', margin: 0, fontSize: 13 }}>
                  Your Privy embedded wallet matches the AGW signer! Key export should work.
                </p>
              </div>
            )}
            {hasEmbedded && !hasOriginalWallet && (
              <div style={{ background: '#2a1a00', border: '1px solid #f5a623', borderRadius: 8, padding: 12, marginTop: 10 }}>
                <p style={{ color: '#f5a623', margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                  Your Privy wallet ({embeddedWallet.address}) does NOT match the AGW signer.
                  Privy may have created a new wallet instead of recovering the original.
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Polygon Balances */}
      {agwSubmitted && k1Owners && (
        <Section title="3. USDC Balances on Polygon">
          {balanceLoading ? (
            <p style={{ color: '#888' }}>Checking balances...</p>
          ) : (
            <>
              <Row label="AGW address on Polygon" value={`${agwBalance ?? '—'} USDC`} />
              {signerBalances?.map((s, i) => (
                <Row
                  key={i}
                  label={`Signer ${s.address.slice(0, 8)}... on Polygon`}
                  value={`${s.balance} USDC`}
                  highlight={parseFloat(s.balance) > 0}
                />
              ))}
              <button onClick={fetchBalances} style={{ ...btnSmall, marginTop: 10 }}>
                Refresh Balances
              </button>
            </>
          )}
        </Section>
      )}

      {/* Export Attempt */}
      <Section title={agwSubmitted && k1Owners ? '4. Export Private Key' : '3. Export Private Key'}>
        <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
          Attempt to export the embedded wallet private key via Privy's secure UI.
          This will only work if your original key shard is available in this browser.
        </p>
        <button onClick={handleExport} style={btnStyle}>
          Attempt Key Export
        </button>
        {exportError && (
          <div style={{ background: '#2a0a0a', border: '1px solid #e74c3c', borderRadius: 8, padding: 12, marginTop: 10 }}>
            <p style={{ color: '#e74c3c', margin: 0, fontSize: 13, wordBreak: 'break-all' }}>
              {exportError}
            </p>
          </div>
        )}
        {exportAttempted && !exportError && (
          <p style={{ color: '#2ecc71', fontSize: 13, marginTop: 10 }}>
            Export modal should have appeared. If you saw your private key, save it securely.
          </p>
        )}
      </Section>

      {/* Recovery Summary */}
      <Section title="Recovery Information Summary">
        <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          Copy this information and provide it to the Abstract Foundation team for assistance:
        </p>
        <div style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
{`Privy User ID: ${user?.id || '—'}
Login Email: ${user?.email?.address || '—'}
Privy Embedded Wallet: ${embeddedWallet?.address || 'NOT FOUND'}
${agwSubmitted && agwAddress ? `AGW Contract Address: ${agwAddress}` : 'AGW Contract Address: (not entered)'}
${k1Owners ? `AGW Signer (k1Owner): ${k1Owners.join(', ')}` : 'AGW Signer: (not queried)'}
Signer Matches Privy Wallet: ${hasOriginalWallet ? 'YES' : 'NO'}
${agwBalance !== null ? `USDC at AGW on Polygon: ${agwBalance}` : ''}
${signerBalances ? signerBalances.map((s) => `USDC at Signer ${s.address} on Polygon: ${s.balance}`).join('\n') : ''}
Export Attempted: ${exportAttempted ? (exportError ? `FAILED — ${exportError}` : 'SUCCESS') : 'No'}
Browser: ${navigator.userAgent}`}
        </div>
        <button
          onClick={() => {
            const text = document.querySelector('[style*="pre-wrap"]')?.textContent;
            if (text) navigator.clipboard.writeText(text);
          }}
          style={{ ...btnSmall, marginTop: 10 }}
        >
          Copy to Clipboard
        </button>
      </Section>

      {/* Next Steps */}
      <Section title="Next Steps">
        <ol style={{ color: '#aaa', fontSize: 13, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>If key export worked, import the private key into MetaMask and check balances.</li>
          <li>If key export failed and you're on a different device, try again on the <strong>original browser/device</strong> where you created your Abstract wallet.</li>
          <li>If the signer doesn't match your Privy wallet, the key shard from your original session is needed. Check if you have a Privy recovery backup (Google Drive / iCloud).</li>
          <li>Contact <strong>Abstract Foundation</strong> with the Recovery Information above. They can work with Privy to help reconstruct access to the signer key.</li>
        </ol>
      </Section>
    </Page>
  );
}

// --- Layout ---

function Page({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#111', color: '#eee',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: 640, width: '100%' }}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 24, padding: 20, background: '#1a1a1a', borderRadius: 10, border: '1px solid #333' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 15, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, mono, highlight }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: '#888', fontSize: 13 }}>{label}: </span>
      <span style={{
        fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 12 : 14,
        wordBreak: 'break-all', color: highlight ? '#2ecc71' : '#eee',
        fontWeight: highlight ? 600 : 400,
      }}>{value}</span>
    </div>
  );
}

const btnStyle = {
  background: '#6c5ce7', color: 'white', border: 'none', borderRadius: 8,
  padding: '12px 24px', fontSize: 15, cursor: 'pointer', fontWeight: 500,
};
const btnSmall = {
  ...btnStyle, background: '#333', fontSize: 13, padding: '6px 14px',
};
const inputStyle = {
  padding: '10px 14px', background: '#222', border: '1px solid #444',
  borderRadius: 8, color: '#eee', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
