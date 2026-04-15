export default function VerificationStatus({ result, error, loading }) {
  if (loading) return (
    <div style={styles.container}>
      <div style={styles.loadingState}>
        <div className="loader" style={{ width: 32, height: 32 }} />
        <div style={styles.loadingTitle}>Verifying Token</div>
        <div style={styles.loadingText}>
          Checking HMAC signature · Validating expiry · Confirming ride ID
        </div>
        <div style={styles.checksRow}>
          {['Signature', 'Expiry', 'Replay', 'Ride ID'].map((c, i) => (
            <div key={c} style={{ ...styles.checkItem, animationDelay: `${i * 0.2}s` }}>
              <div className="loader" style={{ width: 12, height: 12 }} />
              <span>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div style={styles.container}>
      <div style={styles.errorState}>
        <div style={styles.bigIcon}>✗</div>
        <div style={styles.errorTitle}>Verification Failed</div>
        <div style={styles.errorMsg}>{error}</div>
        <div style={styles.checksRow}>
          {getFailureReasons(error).map(r => (
            <div key={r} style={styles.failReason}>⊘ {r}</div>
          ))}
        </div>
        <div style={styles.retryHint}>Ask driver to generate a new QR code and try again.</div>
      </div>
    </div>
  )

  if (result) return (
    <div style={styles.container}>
      <div style={styles.successState}>
        <div style={styles.successIcon}>✓</div>
        <div style={styles.successTitle}>Verified!</div>
        <div style={styles.successMsg}>{result.message}</div>

        <div style={styles.rideInfo}>
          <div style={styles.rideInfoTitle}>RIDE DETAILS</div>
          <div style={styles.rideInfoGrid}>
            <InfoRow label="Driver"      value={result.ride?.driverName} />
            <InfoRow label="Rider"       value={result.ride?.riderName} />
            <InfoRow label="Pickup"      value={result.ride?.pickup} />
            <InfoRow label="Destination" value={result.ride?.destination} />
            <InfoRow label="Verified At" value={result.ride?.verifiedAt ? new Date(result.ride.verifiedAt).toLocaleTimeString() : '—'} />
          </div>
        </div>

        <div style={styles.securityBadge}>
          <span style={styles.secIcon}>⬡</span>
          HMAC-SHA256 · Replay Protected · Location Bound
        </div>
      </div>
    </div>
  )

  return null
}

function InfoRow({ label, value }) {
  return (
    <div style={infoStyles.row}>
      <span style={infoStyles.label}>{label}</span>
      <span style={infoStyles.value}>{value || '—'}</span>
    </div>
  )
}

function getFailureReasons(error = '') {
  if (error.includes('expired'))  return ['Token TTL exceeded (>45s)', 'Generate new QR']
  if (error.includes('Replay'))   return ['Nonce already consumed', 'Replay attack blocked']
  if (error.includes('signature'))return ['HMAC mismatch detected', 'Possible tampering']
  if (error.includes('Malformed'))return ['Token format invalid', 'Wrong QR code scanned']
  return ['Unknown failure', 'Try again']
}

const infoStyles = {
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e8e8e8' },
  label: { fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700', color: '#000' },
}

const styles = {
  container: {
    animation: 'slideUp 0.4s ease forwards',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px 24px',
    border: '2px solid #000',
    textAlign: 'center',
  },
  loadingTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '20px',
    fontWeight: '800',
  },
  loadingText: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    color: '#888',
    lineHeight: 1.6,
  },
  checksRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#888',
    animation: 'fadeIn 0.3s ease forwards',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '32px 24px',
    border: '2px solid #000',
    background: '#f5f5f5',
    textAlign: 'center',
  },
  bigIcon: {
    width: '64px',
    height: '64px',
    border: '3px solid #000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Syne, sans-serif',
    fontSize: '32px',
    fontWeight: '800',
  },
  errorTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: '800',
  },
  errorMsg: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    fontWeight: '700',
    maxWidth: '300px',
  },
  failReason: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#888',
    padding: '4px 8px',
    border: '1px solid #ccc',
  },
  retryHint: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    color: '#aaa',
  },
  successState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '32px 24px',
    border: '2px solid #000',
    background: '#000',
    color: '#fff',
    textAlign: 'center',
  },
  successIcon: {
    width: '72px',
    height: '72px',
    border: '3px solid #fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Syne, sans-serif',
    fontSize: '36px',
    fontWeight: '800',
  },
  successTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '32px',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  successMsg: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    color: '#aaa',
  },
  rideInfo: {
    width: '100%',
    background: '#111',
    border: '2px solid #333',
    padding: '16px',
    textAlign: 'left',
  },
  rideInfoTitle: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px',
  },
  rideInfoGrid: {
    display: 'flex',
    flexDirection: 'column',
  },
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#666',
    border: '1px solid #333',
    padding: '8px 16px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  secIcon: {
    fontSize: '14px',
  },
}
