import { useState, useEffect, useCallback } from 'react'
import { rideAPI } from '../api.js'
import QRScanner from '../components/QRScanner.jsx'
import VerificationStatus from '../components/VerificationStatus.jsx'

const VIEWS   = { SCAN: 'scan', RESULT: 'result', ACTIVE: 'active' }
const VSTATES = { IDLE: 'idle', LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' }

export default function DriverDashboard({ user, onLogout }) {
  const [view,       setView]   = useState(VIEWS.SCAN)
  const [vstate,     setVstate] = useState(VSTATES.IDLE)
  const [result,     setResult] = useState(null)
  const [error,      setError]  = useState('')
  const [scanActive, setScan]   = useState(true)
  const [activeRide, setActive] = useState(null)

  useEffect(() => {
    const check = async () => {
      try {
        const data = await rideAPI.getDriverActiveRide()
        if (data.ride) {
          setActive(data.ride)
          setView(VIEWS.ACTIVE)
          setScan(false)
        }
      } catch {}
    }
    check()
  }, [])

  useEffect(() => {
    if (view !== VIEWS.ACTIVE) return
    const interval = setInterval(async () => {
      try {
        const data = await rideAPI.getDriverActiveRide()
        if (data.ride) setActive(data.ride)
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [view])

  const handleScan = async (rawToken, preVerifiedResult = null) => {
    if (vstate === VSTATES.LOADING) return
    setScan(false)
    setVstate(VSTATES.LOADING)
    setView(VIEWS.RESULT)
    setResult(null)
    setError('')

    if (rawToken === '__pin_verified__' && preVerifiedResult) {
      setResult(preVerifiedResult)
      setVstate(VSTATES.SUCCESS)
      setActive(preVerifiedResult.ride)
      setTimeout(() => setView(VIEWS.ACTIVE), 2500)
      return
    }

    let lat = null, lng = null
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch {}

    try {
      const data = await rideAPI.verifyQR(rawToken, lat, lng)
      setResult(data)
      setVstate(VSTATES.SUCCESS)
      setActive(data.ride)
      setTimeout(() => setView(VIEWS.ACTIVE), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Try again.')
      setVstate(VSTATES.ERROR)
    }
  }

  const handleRetry = () => {
    setVstate(VSTATES.IDLE)
    setResult(null)
    setError('')
    setScan(true)
    setView(VIEWS.SCAN)
  }

  const handleStart = async () => {
    try {
      const data = await rideAPI.startRide(activeRide.id)
      setActive(data.ride)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start ride')
    }
  }

  const handleComplete = async () => {
    try {
      const data = await rideAPI.completeRide(activeRide.id)
      setActive(data.ride)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete ride')
    }
  }

  const handleNewScan = () => {
    setActive(null)
    setResult(null)
    setError('')
    setVstate(VSTATES.IDLE)
    setScan(true)
    setView(VIEWS.SCAN)
  }

  const STATUS_LABELS = {
    waiting:   'Awaiting Scan',
    verified:  'Rider Verified ✓',
    started:   'Ride In Progress',
    completed: 'Completed',
  }

  return (
    <div style={styles.root}>
      {/* ── SIDEBAR ── */}
      <aside style={styles.sidebar}>
        <div style={styles.sideTop}>
          <div style={styles.logo}>
            <img src="/logo.jpg" alt="QRV" style={styles.logoImg} />
            <div>
              <div style={styles.logoName}>QRV</div>
              <div style={styles.logoRole}>Driver Panel</div>
            </div>
          </div>

          <nav style={styles.nav}>
            {[
              { key: VIEWS.SCAN,   icon: '⊟', label: 'Scan QR' },
              { key: VIEWS.ACTIVE, icon: '⊡', label: 'Active Ride', disabled: !activeRide },
            ].map(item => (
              <button
                key={item.key}
                style={{
                  ...styles.navItem,
                  ...(view === item.key ? styles.navItemActive : {}),
                  ...(item.disabled ? styles.navItemDisabled : {}),
                }}
                onClick={() => !item.disabled && setView(item.key)}
                type="button"
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
                {item.key === VIEWS.ACTIVE && activeRide?.status === 'verified' && (
                  <span style={styles.notifDot} />
                )}
              </button>
            ))}
          </nav>

          <div style={styles.secInfo}>
            <div style={styles.secTitle}>DRIVER PROTOCOL</div>
            {[
              "Scan rider's QR to accept ride",
              'QR valid for 45 seconds only',
              'Token verified server-side',
              'Prevents fare fraud & spoofing',
            ].map(t => (
              <div key={t} style={styles.secItem}>
                <span style={styles.secCheck}>⊛</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sideBottom}>
          <div style={styles.userCard}>
            <div style={styles.userAvatar}>{user.name[0]}</div>
            <div>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userVehicle}>{user.vehicle || 'Driver'}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-full" onClick={onLogout} style={{ color: '#fff', borderColor: '#333' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <h1 style={styles.pageTitle}>
              {view === VIEWS.SCAN   ? 'Scan Rider QR' : ''}
              {view === VIEWS.RESULT ? 'Verifying...'  : ''}
              {view === VIEWS.ACTIVE ? 'Active Ride'   : ''}
            </h1>
            <div style={styles.pageInfo}>
              {view === VIEWS.SCAN   && "Scan the QR code or enter the PIN from the rider's screen"}
              {view === VIEWS.ACTIVE && activeRide && `Status: ${STATUS_LABELS[activeRide.status] || activeRide.status}`}
            </div>
          </div>

          {activeRide && view === VIEWS.ACTIVE && (
            <div style={styles.statusPill}>
              <span className="status-dot" style={activeRide.status === 'started' ? { animation: 'blink 1s infinite' } : {}} />
              {STATUS_LABELS[activeRide.status]}
            </div>
          )}
        </div>

        <div style={styles.content}>

          {/* ── SCAN VIEW ── */}
          {view === VIEWS.SCAN && (
            <div style={styles.scanLayout} className="animate-slide-up">
              <div style={styles.scanLeft}>
                <div className="card card-elevated" style={{ padding: '24px' }}>
                  <QRScanner onScan={handleScan} active={scanActive} />
                </div>
              </div>

              <div style={styles.scanRight}>
                <div className="card" style={{ padding: '24px' }}>
                  <div style={styles.howTitle}>HOW IT WORKS</div>
                  {[
                    { step: '01', title: 'Rider books ride',     desc: 'Rider creates their trip and gets a cryptographic QR code from QRV.' },
                    { step: '02', title: 'Scan the QR',          desc: "Use this scanner or enter rider's 6-digit PIN. No verbal OTP calls." },
                    { step: '03', title: 'Instant verification', desc: 'HMAC-SHA256 signature verified server-side in milliseconds.' },
                    { step: '04', title: 'Start the ride',       desc: 'Once verified, start and complete the trip safely.' },
                  ].map(s => (
                    <div key={s.step} style={styles.howStep}>
                      <div style={styles.howNum}>{s.step}</div>
                      <div>
                        <div style={styles.howStepTitle}>{s.title}</div>
                        <div style={styles.howStepDesc}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ padding: '20px', marginTop: '16px', background: '#f5f5f5' }}>
                  <div style={styles.warningTitle}>⊘ NEVER TRUST VERBAL OTP</div>
                  <div style={styles.warningText}>
                    Always verify rides via QR scan or the 6-digit PIN entry below.
                    Never accept a ride based on an unverified verbal code alone.
                    If something feels off — don't start the ride.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RESULT VIEW ── */}
          {view === VIEWS.RESULT && (
            <div style={styles.resultLayout} className="animate-slide-up">
              <VerificationStatus
                result={vstate === VSTATES.SUCCESS ? result : null}
                error={vstate === VSTATES.ERROR ? error : null}
                loading={vstate === VSTATES.LOADING}
              />
              {vstate === VSTATES.ERROR && (
                <button className="btn btn-primary btn-lg" onClick={handleRetry} style={{ marginTop: '16px' }}>
                  ← Scan Again
                </button>
              )}
            </div>
          )}

          {/* ── ACTIVE RIDE VIEW ── */}
          {view === VIEWS.ACTIVE && activeRide && (
            <div style={styles.twoCol} className="animate-slide-up">
              {/* Left: Ride details */}
              <div className="card card-elevated" style={{ padding: '24px' }}>
                <div style={styles.rideCardTitle}>
                  RIDE #{activeRide.id?.slice(0, 8).toUpperCase()}
                </div>

                <div style={styles.rideDetails}>
                  <DetailRow label="Rider"       value={activeRide.riderName} />
                  <DetailRow label="Pickup"      value={activeRide.pickup} />
                  <DetailRow label="Destination" value={activeRide.destination} />
                  <DetailRow label="Status"      value={activeRide.status.toUpperCase()} />
                  {activeRide.verifiedAt  && <DetailRow label="Verified At" value={new Date(activeRide.verifiedAt).toLocaleTimeString()} />}
                  {activeRide.startedAt   && <DetailRow label="Started At"  value={new Date(activeRide.startedAt).toLocaleTimeString()} />}
                </div>

                <div style={styles.actions}>
                  {activeRide.status === 'verified' && (
                    <button className="btn btn-primary btn-full btn-lg" onClick={handleStart}>
                      ▶ Start Ride
                    </button>
                  )}
                  {activeRide.status === 'started' && (
                    <button className="btn btn-primary btn-full btn-lg" onClick={handleComplete}>
                      ⊠ Complete Ride
                    </button>
                  )}
                  {activeRide.status === 'completed' && (
                    <>
                      <div style={styles.completedMsg}>Ride completed successfully!</div>
                      <button className="btn btn-secondary btn-full" onClick={handleNewScan}>
                        Scan New Rider
                      </button>
                    </>
                  )}
                </div>

                {error && <div style={{ ...styles.errorBox, marginTop: '12px' }}>{error}</div>}
              </div>

              {/* Right: Security info */}
              <div>
                <div className="card" style={{ padding: '20px', background: '#000', color: '#fff', marginBottom: '16px' }}>
                  <div style={styles.proofTitle}>VERIFICATION PROOF</div>
                  <div style={styles.proofGrid}>
                    <ProofItem label="Algorithm" value="HMAC-SHA256" />
                    <ProofItem label="Token Type" value="Base64url" />
                    <ProofItem label="TTL" value="45 seconds" />
                    <ProofItem label="Replay" value="Nonce Blacklist" />
                    <ProofItem label="Binding" value="Ride ID + Rider ID" />
                    <ProofItem label="Verified" value={activeRide.verifiedAt ? '✓ YES' : '—'} />
                  </div>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <div style={styles.logTitle}>SECURITY LOG</div>
                  <div style={styles.logEntries}>
                    <LogEntry time={new Date(activeRide.createdAt).toLocaleTimeString()} text={`Ride created by ${activeRide.riderName}`} />
                    {activeRide.verifiedAt  && <LogEntry time={new Date(activeRide.verifiedAt).toLocaleTimeString()}  text="QR verified by driver"  icon="✓" />}
                    {activeRide.startedAt   && <LogEntry time={new Date(activeRide.startedAt).toLocaleTimeString()}   text="Ride started"           icon="▶" />}
                    {activeRide.completedAt && <LogEntry time={new Date(activeRide.completedAt).toLocaleTimeString()} text="Ride completed"         icon="⊠" />}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e8e8e8' }}>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700' }}>{value}</span>
    </div>
  )
}

function ProofItem({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222' }}>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700', color: '#fff' }}>{value}</span>
    </div>
  )
}

function LogEntry({ time, text, icon = '·' }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#888', minWidth: '70px' }}>{time}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#444' }}>{icon} {text}</span>
    </div>
  )
}

const styles = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: {
    width: '240px', background: '#000', color: '#fff',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '24px 20px', borderRight: '2px solid #000', flexShrink: 0,
  },
  sideTop: { display: 'flex', flexDirection: 'column', gap: '32px' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoImg: { width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' },
  logoName: { fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '18px' },
  logoRole: { fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', fontFamily: 'Space Mono, monospace', fontSize: '12px',
    color: '#888', background: 'transparent', border: '1px solid transparent',
    cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left', position: 'relative',
  },
  navItemActive:   { color: '#fff', borderColor: '#333', background: '#111' },
  navItemDisabled: { opacity: 0.3, cursor: 'default' },
  navIcon: { fontSize: '16px', minWidth: '20px' },
  notifDot: {
    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
    width: '8px', height: '8px', background: '#fff', borderRadius: '50%',
    animation: 'blink 1s infinite',
  },
  secInfo: { display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '24px', borderTop: '1px solid #222' },
  secTitle: { fontFamily: 'Space Mono, monospace', fontSize: '9px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' },
  secItem: { display: 'flex', gap: '8px', alignItems: 'flex-start', fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#666', lineHeight: 1.5 },
  secCheck: { color: '#444', flexShrink: 0 },
  sideBottom: { display: 'flex', flexDirection: 'column', gap: '16px' },
  userCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #222' },
  userAvatar: {
    width: '36px', height: '36px', border: '2px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '16px',
  },
  userName:    { fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700' },
  userVehicle: { fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#666' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 32px', borderBottom: '2px solid #000',
  },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em' },
  pageInfo:  { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#888', marginTop: '4px' },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700',
    padding: '8px 16px', border: '2px solid #000', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  content:    { flex: 1, overflowY: 'auto', padding: '32px' },
  scanLayout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
  scanLeft:   {},
  scanRight:  {},
  howTitle:    { fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '20px', textTransform: 'uppercase' },
  howStep:     { display: 'flex', gap: '16px', padding: '14px 0', borderBottom: '1px solid #e8e8e8' },
  howNum:      { fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: '800', color: '#e8e8e8', minWidth: '36px' },
  howStepTitle: { fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700', marginBottom: '4px' },
  howStepDesc:  { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#888', lineHeight: 1.6 },
  warningTitle: { fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '800', marginBottom: '10px' },
  warningText:  { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#666', lineHeight: 1.7 },
  resultLayout: { maxWidth: '480px', display: 'flex', flexDirection: 'column' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
  rideCardTitle: { fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '16px' },
  rideDetails:   { marginBottom: '24px' },
  actions:       { display: 'flex', flexDirection: 'column', gap: '12px' },
  completedMsg: {
    fontFamily: 'Space Mono, monospace', fontSize: '13px', fontWeight: '700',
    padding: '16px', border: '2px solid #000', background: '#f5f5f5', textAlign: 'center',
  },
  errorBox: {
    padding: '12px 16px', border: '2px solid #c00', background: '#fff5f5',
    fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700', color: '#c00',
  },
  proofTitle: { fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase' },
  proofGrid:  { display: 'flex', flexDirection: 'column' },
  logTitle:   { fontFamily: 'Space Mono, monospace', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#888', marginBottom: '12px', textTransform: 'uppercase' },
  logEntries: { display: 'flex', flexDirection: 'column' },
}
