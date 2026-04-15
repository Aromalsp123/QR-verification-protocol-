import { useState } from 'react'
import { authAPI } from '../api.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [activeTab, setActiveTab] = useState('driver')

  const DEMO_CREDS = {
    driver: [
      { username: 'driver1', password: 'driver123', name: 'Rajan Kumar' },
      { username: 'driver2', password: 'driver123', name: 'Suresh Nair' },
    ],
    rider: [
      { username: 'rider1', password: 'rider123', name: 'Priya Menon' },
      { username: 'rider2', password: 'rider123', name: 'Anil Thomas' },
    ],
  }

  const quickLogin = (cred) => {
    setUsername(cred.username)
    setPassword(cred.password)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authAPI.login(username, password)
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root} className="noise-overlay">

      {/* ── LEFT PANEL ── */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          <div style={styles.brand}>
            <img src="/logo.jpg" alt="QRV Protocol" style={styles.brandLogo} />
            <div>
              <div style={styles.brandName}>QRV Protocol</div>
              <div style={styles.brandSub}>QR Ride Verification</div>
            </div>
          </div>

          <div style={styles.heroText}>
            <h1 style={styles.hero}>Zero-OTP<br />Ride<br />Verification.</h1>
            <p style={styles.heroPara}>
              No secrets shared over phone.<br />
              No social engineering possible.<br />
              Verification dies if you're not there.
            </p>
          </div>

          <div style={styles.featureList}>
            {[
              ['01', 'HMAC-SHA256 Signed QR Tokens'],
              ['02', '45-Second Expiry + Replay Guard'],
              ['03', 'Location-Locked Verification'],
              ['04', 'Zero Voice/Text Secrets'],
            ].map(([num, text]) => (
              <div key={num} style={styles.feature}>
                <span style={styles.featureNum}>{num}</span>
                <span style={styles.featureText}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={styles.right}>
        <div style={styles.formWrap} className="animate-slide-up">

          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Access Panel</h2>
            <p style={styles.formSub}>Sign in to continue</p>
          </div>

          {/* Role Tabs */}
          <div style={styles.tabs}>
            {['driver', 'rider'].map(tab => (
              <button
                key={tab}
                style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab === 'driver' ? '⬢ Driver' : '◉ Rider'}
              </button>
            ))}
          </div>

          {/* Quick Login Buttons */}
          <div style={styles.quickSection}>
            <div style={styles.quickLabel}>QUICK LOGIN →</div>
            <div style={styles.quickGrid}>
              {DEMO_CREDS[activeTab].map(cred => (
                <button
                  key={cred.username}
                  style={styles.quickBtn}
                  onClick={() => quickLogin(cred)}
                  type="button"
                >
                  {cred.name}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.divider} />

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input
                className="input"
                type="text"
                placeholder={activeTab === 'driver' ? 'driver1' : 'rider1'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              className="btn btn-primary btn-lg btn-full"
              type="submit"
              disabled={loading}
            >
              {loading ? <><span className="loader loader-white" /> Authenticating...</> : 'Sign In →'}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerText}>QRV MVP v1.0</span>
            <span style={styles.footerText}>Black & White Protocol</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  left: {
    flex: 1,
    background: '#000',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
  },
  leftInner: {
    maxWidth: '440px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  brandLogo: {
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: '8px',
  },
  brandName: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: '800',
    fontSize: '18px',
    letterSpacing: '-0.01em',
  },
  brandSub: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '2px',
  },
  heroText: {},
  hero: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 'clamp(40px, 5vw, 64px)',
    fontWeight: '800',
    lineHeight: '1.0',
    letterSpacing: '-0.03em',
    color: '#fff',
    marginBottom: '20px',
  },
  heroPara: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '1.8',
    color: '#888',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    borderTop: '1px solid #222',
    paddingTop: '32px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  featureNum: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#555',
    minWidth: '24px',
  },
  featureText: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    color: '#aaa',
  },
  right: {
    width: '460px',
    background: '#fff',
    borderLeft: '2px solid #000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    overflowY: 'auto',
  },
  formWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  formHeader: {},
  formTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '28px',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    marginBottom: '4px',
  },
  formSub: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tabs: {
    display: 'flex',
    border: '2px solid #000',
  },
  tab: {
    flex: 1,
    padding: '10px',
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: '#fff',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabActive: {
    background: '#000',
    color: '#fff',
  },
  quickSection: {},
  quickLabel: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '10px',
    textTransform: 'uppercase',
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  quickBtn: {
    padding: '10px',
    border: '2px solid #000',
    background: '#f5f5f5',
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  divider: {
    height: '2px',
    background: '#e8e8e8',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorBox: {
    padding: '12px 16px',
    border: '2px solid #000',
    background: '#f5f5f5',
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    fontWeight: '700',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid #e8e8e8',
  },
  footerText: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#ccc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}
