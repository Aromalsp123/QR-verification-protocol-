import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { rideAPI } from '../api.js'

export default function QRDisplay({ rideId, onRefresh }) {
  const [qrToken,   setQrToken]   = useState(null)
  const [pin,       setPin]       = useState(null)
  const [timeLeft,  setTimeLeft]  = useState(45)
  const [expiresAt, setExpiresAt] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [genCount,  setGenCount]  = useState(0)
  const [copied,    setCopied]    = useState(false)
  const refreshTimerRef = useRef(null)
  const fetchingRef     = useRef(false)

  const fetchQR = useCallback(async () => {
    if (!rideId || fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError('')
    setCopied(false)
    try {
      const data = await rideAPI.generateQR(rideId)

      // Encode ONLY the short 6-digit PIN in the QR → simple, scannable QR code.
      // Driver scans this PIN the same way as manual PIN entry (verifyPin endpoint).
      const tokenToEncode = data.pin || data.shortQrToken || `RIDE:${rideId}`

      setQrToken(tokenToEncode)
      setPin(data.pin)
      setExpiresAt(data.expiresAt)
      setTimeLeft(45)
      setGenCount((c) => c + 1)
      if (onRefresh) onRefresh(data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate QR')
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [rideId, onRefresh])

  useEffect(() => {
    setQrToken(null)
    setPin(null)
    setExpiresAt(null)
    setTimeLeft(45)
    setGenCount(0)
    setError('')
    setCopied(false)
  }, [rideId])

  useEffect(() => { fetchQR() }, [fetchQR])

  useEffect(() => {
    if (!expiresAt) return
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)

    refreshTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
        fetchQR()
      }
    }, 500)

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [expiresAt, fetchQR])

  const handleCopyPin = async () => {
    if (!pin) return
    try { await navigator.clipboard.writeText(pin) } catch {
      const el = document.createElement('textarea')
      el.value = pin
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const progress      = (timeLeft / 45) * 100
  const isUrgent      = timeLeft <= 10
  const circumference = 2 * Math.PI * 54

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>ACTIVE QR TOKEN</div>
          <div style={styles.subtitle}>Driver must scan within window</div>
        </div>
        <div style={styles.genBadge}>GEN #{String(genCount).padStart(3, '0')}</div>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>
          <div className="loader" style={{ width: 32, height: 32 }} />
          <div style={styles.loadingText}>Generating secure token...</div>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <div style={styles.errorText}>{error}</div>
          <button className="btn btn-primary btn-sm" onClick={fetchQR}>Retry</button>
        </div>
      ) : qrToken ? (
        <>
          {/* QR Code with countdown ring */}
          <div style={styles.qrWrapper}>
            <svg style={styles.timerRing} viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e8e8e8" strokeWidth="4" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke="#000" strokeWidth="4" strokeLinecap="square"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (progress / 100) * circumference}
                transform="rotate(-90 60 60)"
                style={{
                  transition: 'stroke-dashoffset 0.5s linear',
                  opacity: isUrgent ? 1 : 0.3,
                  animation: isUrgent ? 'pulse 0.5s infinite alternate' : 'none',
                }}
              />
            </svg>
            <div style={{ ...styles.qrBox, opacity: timeLeft === 0 ? 0.2 : 1 }}>
              <QRCodeCanvas value={qrToken} size={200} level="M" fgColor="#000" bgColor="#fff" includeMargin={false} />
              <div style={styles.scanLine} />
            </div>
          </div>

          {/* Timer */}
          <div style={{ ...styles.timerDisplay, background: isUrgent ? '#000' : '#f5f5f5' }}>
            <div style={{ ...styles.timerNum, color: isUrgent ? '#fff' : '#000' }}>
              {String(timeLeft).padStart(2, '0')}
            </div>
            <div style={{ ...styles.timerLabel, color: isUrgent ? '#aaa' : '#888' }}>
              {isUrgent ? '⚠ EXPIRING SOON' : 'SECONDS REMAINING'}
            </div>
          </div>

          {/* ── PIN Section ── */}
          <div style={styles.pinCard}>
            <div style={styles.pinTopRow}>
              <span style={styles.pinCardLabel}>Verification PIN</span>
              <span style={styles.pinCardHint}>Tell this to your driver</span>
            </div>

            {/* Big centered number */}
            <div style={styles.pinNumber}>
              {pin ? `${pin.slice(0, 3)} ${pin.slice(3)}` : '— — —'}
            </div>

            <div style={styles.pinActions}>
              <div style={styles.pinExpiry}>Expires in {timeLeft}s</div>
              <button
                id="copy-pin-btn"
                onClick={handleCopyPin}
                style={{
                  ...styles.copyBtn,
                  background: copied ? '#000' : '#fff',
                  color: copied ? '#fff' : '#000',
                }}
              >
                {copied ? '✓ Copied' : 'Copy PIN'}
              </button>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm btn-full"
            onClick={fetchQR}
            disabled={loading}
          >
            ↻ Refresh Token &amp; PIN
          </button>
        </>
      ) : null}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: {
    fontFamily: 'Syne, sans-serif', fontSize: '14px', fontWeight: '800',
    letterSpacing: '0.05em', textTransform: 'uppercase',
  },
  subtitle: { fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#888', marginTop: '2px' },
  genBadge: {
    fontFamily: 'Space Mono, monospace', fontSize: '10px', fontWeight: '700',
    padding: '4px 8px', border: '2px solid #000', letterSpacing: '0.05em',
  },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px', padding: '48px', border: '2px dashed #ccc',
  },
  loadingText: { fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#888' },
  errorBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px', padding: '32px', border: '2px solid #000', background: '#f5f5f5',
  },
  errorText: { fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700', textAlign: 'center' },
  qrWrapper: {
    position: 'relative', display: 'flex',
    justifyContent: 'center', alignItems: 'center', padding: '16px',
  },
  timerRing: {
    position: 'absolute', width: '260px', height: '260px',
    top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
  },
  qrBox: {
    padding: '16px', border: '2px solid #000', background: '#fff',
    position: 'relative', overflow: 'hidden',
    boxShadow: '4px 4px 0 #000', transition: 'opacity 0.3s ease',
  },
  scanLine: {
    position: 'absolute', left: 0, width: '100%', height: '2px',
    background: 'rgba(0,0,0,0.6)', animation: 'scanLine 2s linear infinite', top: 0,
  },
  timerDisplay: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '12px', border: '2px solid #000', transition: 'background 0.3s ease',
  },
  timerNum: {
    fontFamily: 'Syne, sans-serif', fontSize: '40px', fontWeight: '800',
    letterSpacing: '-0.03em', lineHeight: 1, transition: 'color 0.3s ease',
  },
  timerLabel: {
    fontFamily: 'Space Mono, monospace', fontSize: '10px', fontWeight: '700',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '4px',
  },

  // ── PIN card ──────────────────────────────────────────────────────────────
  pinCard: {
    border: '2px solid #000',
    padding: '16px 20px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  pinTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pinCardLabel: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#333',
  },
  pinCardHint: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#999',
  },
  pinNumber: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '44px',
    fontWeight: '800',
    letterSpacing: '0.12em',
    color: '#000',
    textAlign: 'center',
    padding: '8px 0',
    borderTop: '1px solid #eee',
    borderBottom: '1px solid #eee',
  },
  pinActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinExpiry: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '10px',
    color: '#aaa',
  },
  copyBtn: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    fontWeight: '700',
    padding: '6px 14px',
    border: '2px solid #000',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.04em',
  },
}