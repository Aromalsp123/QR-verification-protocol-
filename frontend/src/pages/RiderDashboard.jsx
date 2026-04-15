import { useState, useEffect } from 'react'
import { rideAPI } from '../api.js'
import QRDisplay from '../components/QRDisplay.jsx'
import VerificationStatus from '../components/VerificationStatus.jsx'

const VIEWS = { HOME: 'home', QR: 'qr', ACTIVE: 'active' }

export default function RiderDashboard({ user, onLogout }) {
  const [view,        setView]    = useState(VIEWS.HOME)
  const [ride,        setRide]    = useState(null)
  const [loading,     setLoading] = useState(false)
  const [error,       setError]   = useState('')
  const [pickup,      setPickup]  = useState('')
  const [destination, setDest]    = useState('')

  const STATUS_LABELS = {
    waiting:   'Waiting for Driver',
    verified:  'Driver Verified ✓',
    started:   'Ride In Progress',
    completed: 'Ride Completed',
  }

  useEffect(() => {
    const check = async () => {
      try {
        const data = await rideAPI.getRiderActiveRide()
        if (data.ride) {
          setRide(data.ride)
          setView(data.ride.status === 'waiting' ? VIEWS.QR : VIEWS.ACTIVE)
        }
      } catch {}
    }
    check()
  }, [])

  useEffect(() => {
    if (!ride || view === VIEWS.HOME) return
    const interval = setInterval(async () => {
      try {
        const data = await rideAPI.getRiderActiveRide()
        if (data.ride) {
          setRide(data.ride)
          if (data.ride.status !== 'waiting' && view === VIEWS.QR) setView(VIEWS.ACTIVE)
        }
      } catch {}
    }, 2500)
    return () => clearInterval(interval)
  }, [ride?.id, view])

  const handleCreateRide = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await rideAPI.createRide(pickup || 'Current Location', destination || 'Destination')
      setRide(data.ride)
      setView(VIEWS.QR)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ride')
    } finally {
      setLoading(false)
    }
  }

  const handleNewRide = () => {
    setRide(null)
    setPickup('')
    setDest('')
    setError('')
    setView(VIEWS.HOME)
  }

  const scfg = {
    waiting:   { label: 'Waiting for Driver', dot: true  },
    verified:  { label: 'Driver Verified ✓',  dot: false },
    started:   { label: 'Ride In Progress',   dot: true  },
    completed: { label: 'Completed',          dot: false },
  }[ride?.status] || { label: '', dot: false }

  return (
    <div style={styles.root}>
      {/* ── SIDEBAR ── */}
      <aside style={styles.sidebar}>
        <div style={styles.sideTop}>
          <div style={styles.logo}>
            <img src="/logo.jpg" alt="QRV" style={styles.logoImg} />
            <div>
              <div style={styles.logoName}>QRV</div>
              <div style={styles.logoRole}>Rider Panel</div>
            </div>
          </div>

          <nav style={styles.nav}>
            {[
              { key: VIEWS.HOME,   icon: '⊞', label: 'Book Ride'  },
              { key: VIEWS.QR,     icon: '⊟', label: 'My QR Code', disabled: !ride || ride.status !== 'waiting' },
              { key: VIEWS.ACTIVE, icon: '⊡', label: 'My Ride',    disabled: !ride || ride.status === 'waiting'  },
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
              </button>
            ))}
          </nav>

          <div style={styles.secInfo}>
            <div style={styles.secTitle}>WHY THIS IS SAFE</div>
            {[
              'No OTP shared verbally',
              'QR expires in 45 seconds',
              'Signatures cannot be forged',
              'Each token single-use only',
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
              <div style={styles.userRole}>Rider</div>
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
              {view === VIEWS.HOME   ? 'Book a Ride'  : ''}
              {view === VIEWS.QR     ? 'Show QR Code' : ''}
              {view === VIEWS.ACTIVE ? 'My Ride'      : ''}
            </h1>
            <div style={styles.pageInfo}>
              {view === VIEWS.HOME   && 'Create a ride and show your QR to the driver'}
              {view === VIEWS.QR     && 'Show this QR or read the PIN to your driver'}
              {view === VIEWS.ACTIVE && ride && `Status: ${STATUS_LABELS[ride.status] || ride.status}`}
            </div>
          </div>
          {ride && view !== VIEWS.HOME && (
            <div style={styles.statusPill}>
              {scfg.dot && <span className="status-dot" style={{ animation: 'blink 1s infinite' }} />}
              {scfg.label}
            </div>
          )}
        </div>

        <div style={styles.content}>

          {/* ── HOME ── */}
          {view === VIEWS.HOME && (
            <div style={styles.section} className="animate-slide-up">
              <div style={styles.sectionHead}>
                <h2 style={styles.sectionTitle}>Create New Ride</h2>
                <p style={styles.sectionDesc}>
                  Enter your pickup and destination. A secure QR code and PIN will be generated for your driver.
                </p>
              </div>
              <form onSubmit={handleCreateRide} style={styles.form}>
                <div className="input-group">
                  <label className="input-label">Pickup Location</label>
                  <input className="input" placeholder="e.g. Cochin International Airport" value={pickup} onChange={e => setPickup(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Destination</label>
                  <input className="input" placeholder="e.g. MG Road, Ernakulam" value={destination} onChange={e => setDest(e.target.value)} />
                </div>
                {error && <div style={styles.errorBox}>{error}</div>}
                <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
                  {loading ? <><span className="loader loader-white" /> Creating...</> : 'Create Ride & Get QR →'}
                </button>
              </form>
              <div style={styles.protocolInfo}>
                <div style={styles.protocolTitle}>QRV PROTOCOL</div>
                {[
                  ['HMAC-SHA256', 'Signature on every token'],
                  ['45s TTL',     'Auto-expiry prevents replay'],
                  ['Nonce Guard', 'Single-use token enforcement'],
                  ['6-digit PIN', 'Human-readable verbal fallback'],
                ].map(([k, v]) => (
                  <div key={k} style={styles.protocolRow}>
                    <span style={styles.protocolKey}>{k}</span>
                    <span style={styles.protocolVal}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── QR VIEW ── */}
          {view === VIEWS.QR && ride && (
            <div style={styles.twoCol} className="animate-slide-up">
              <div>
                <div className="card card-elevated" style={{ padding: '24px' }}>
                  <QRDisplay rideId={ride.id} />
                </div>
              </div>
              <div>
                <div className="card card-elevated" style={{ padding: '24px' }}>
                  <div style={styles.rideCardTitle}>RIDE #{ride.id.slice(0, 8).toUpperCase()}</div>
                  <div style={styles.rideDetails}>
                    <DetailRow label="Pickup"      value={ride.pickup} />
                    <DetailRow label="Destination" value={ride.destination} />
                    <DetailRow label="Status"      value="Waiting for driver" />
                    <DetailRow label="Created"     value={new Date(ride.createdAt).toLocaleTimeString()} />
                  </div>
                  <div style={styles.waitingMsg}>
                    <span className="status-dot" style={{ animation: 'blink 1s infinite' }} />
                    Scan QR or tell driver your PIN
                  </div>
                </div>
                <div className="card" style={{ padding: '20px', marginTop: '16px', background: '#f5f5f5' }}>
                  <div style={styles.warningTitle}>HOW IT WORKS</div>
                  <div style={styles.warningText}>
                    1. Show the QR code to your driver to scan.<br />
                    2. Or read the 6-digit PIN aloud — driver types it in.<br />
                    3. You will see an update once the driver verifies.<br />
                    4. Ride starts — have a safe journey!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVE VIEW ── */}
          {view === VIEWS.ACTIVE && ride && (
            <div style={styles.activeLayout} className="animate-slide-up">
              <div style={styles.activeCard}>
                <div style={styles.activeHeader}>
                  <div style={styles.activeRideId}>RIDE #{ride.id?.slice(0, 8).toUpperCase()}</div>
                  <div style={{ ...styles.activeStatus, background: ride.status === 'completed' ? '#000' : '#f5f5f5', color: ride.status === 'completed' ? '#fff' : '#000' }}>
                    {ride.status === 'started' && <span className="status-dot blinking" />}
                    {STATUS_LABELS[ride.status]}
                  </div>
                </div>
                <div style={styles.activeDetails}>
                  <BigDetailRow icon="⊞" label="Pickup"      value={ride.pickup} />
                  <BigDetailRow icon="⊟" label="Destination" value={ride.destination} />
                  <BigDetailRow icon="⬡" label="Driver"      value={ride.driverName || '—'} />
                  {ride.verifiedAt && <BigDetailRow icon="✓" label="Verified At" value={new Date(ride.verifiedAt).toLocaleTimeString()} />}
                </div>
                {ride.status === 'verified' && (
                  <div style={styles.inProgressMsg}><span className="status-dot blinking" />Driver verified! Waiting for ride to start...</div>
                )}
                {ride.status === 'started' && (
                  <div style={styles.inProgressMsg}><span className="status-dot blinking" />Ride in progress — have a safe journey!</div>
                )}
                {ride.status === 'completed' && (
                  <div style={styles.completedMsg}>
                    <div style={styles.completedIcon}>✓</div>
                    <div>Ride completed! Thank you for using QRV Protocol.</div>
                    <button className="btn btn-secondary" onClick={handleNewRide} style={{ marginTop: '8px' }} type="button">Book New Ride</button>
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: '20px', background: '#000', color: '#fff' }}>
                <div style={styles.proofTitle}>VERIFICATION PROOF</div>
                <div style={styles.proofGrid}>
                  <ProofItem label="Algorithm" value="HMAC-SHA256" />
                  <ProofItem label="Token Type" value="Base64url" />
                  <ProofItem label="TTL" value="45 seconds" />
                  <ProofItem label="Replay" value="Nonce Blacklist" />
                  <ProofItem label="Binding" value="Ride ID + Rider ID" />
                  <ProofItem label="Verified" value={ride.verifiedAt ? '✓ YES' : '—'} />
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

function BigDetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '14px 0', borderBottom: '1px solid #e8e8e8', alignItems: 'center' }}>
      <span style={{ fontSize: '18px', minWidth: '24px' }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', fontWeight: '700' }}>{value || '—'}</div>
      </div>
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
    cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left',
  },
  navItemActive: { color: '#fff', borderColor: '#333', background: '#111' },
  navItemDisabled: { opacity: 0.3, cursor: 'default' },
  navIcon: { fontSize: '16px', minWidth: '20px' },
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
  userName: { fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '700' },
  userRole: { fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#666' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 32px', borderBottom: '2px solid #000',
  },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em' },
  pageInfo: { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#888', marginTop: '4px' },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700',
    padding: '8px 16px', border: '2px solid #000', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  content: { flex: 1, overflowY: 'auto', padding: '32px' },
  section: { maxWidth: '600px' },
  sectionHead: { marginBottom: '32px' },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: '800', marginBottom: '8px' },
  sectionDesc: { fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#888', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' },
  errorBox: {
    padding: '12px 16px', border: '2px solid #000', background: '#f5f5f5',
    fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700',
  },
  protocolInfo: { padding: '20px', border: '2px solid #000', background: '#f5f5f5' },
  protocolTitle: { fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '0.1em', marginBottom: '16px' },
  protocolRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e8e8e8' },
  protocolKey: { fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700' },
  protocolVal: { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#888' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' },
  rideCardTitle: { fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '16px' },
  rideDetails: { marginBottom: '20px' },
  waitingMsg: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#888',
    padding: '12px', border: '1px solid #e8e8e8',
  },
  warningTitle: { fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: '800', marginBottom: '10px' },
  warningText: { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#666', lineHeight: 1.9 },
  activeLayout: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' },
  activeCard: { border: '2px solid #000', padding: '24px' },
  activeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  activeRideId: { fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: '800' },
  activeStatus: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: 'Space Mono, monospace', fontSize: '10px', fontWeight: '700',
    padding: '6px 12px', border: '2px solid #000', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  activeDetails: { marginBottom: '24px' },
  inProgressMsg: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontFamily: 'Space Mono, monospace', fontSize: '13px', fontWeight: '700',
    padding: '14px', border: '2px solid #000', background: '#f5f5f5',
  },
  completedMsg: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    padding: '24px', border: '2px solid #000', background: '#000', color: '#fff',
    fontFamily: 'Space Mono, monospace', fontSize: '13px', textAlign: 'center',
  },
  completedIcon: {
    width: '48px', height: '48px', border: '2px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: '800',
  },
  proofTitle: { fontFamily: 'Syne, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase' },
  proofGrid: { display: 'flex', flexDirection: 'column' },
}
