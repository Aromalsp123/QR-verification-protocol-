import { useEffect, useRef, useState, useCallback } from 'react'
import { rideAPI } from '../api.js'

export default function QRScanner({ onScan, onError, active = true }) {
  const scannerRef  = useRef(null)
  const scanningRef  = useRef(false)
  const lastScanRef  = useRef(0)
  const fileInputRef = useRef(null)

  const [status, setStatus] = useState('initializing')
  const [errMsg, setErrMsg] = useState('')
  const [flashActive, setFlash] = useState(false)

  // File scan
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError,   setFileError]   = useState('')

  // PIN input
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  const normalizeDecodedText = useCallback((text) => {
    if (typeof text !== 'string') return ''
    return text.trim()
  }, [])

  useEffect(() => {
    let cancelled = false

    const stopScanner = async () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      scanningRef.current = false

      if (!scanner) return

      try { await scanner.stop() } catch { }
      try { await scanner.clear() } catch { }
    }

    if (!active) {
      setStatus('paused')
      stopScanner()
      return () => { }
    }

    const initScanner = async () => {
      try {
        const container = document.getElementById('qr-scanner-container')
        if (!container) return

        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        await stopScanner()

        const html5Qr = new Html5Qrcode('qr-scanner-container')
        scannerRef.current = html5Qr
        scanningRef.current = true

        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (w, h) => ({
              width: Math.min(w, 300),
              height: Math.min(h, 300),
            }),
            aspectRatio: 1.0,
            disableFlip: false,
          },
          async (decodedText) => {
            if (!scanningRef.current) return

            const scannedText = normalizeDecodedText(decodedText)
            if (!scannedText) return

            // 🔒 debounce protection
            const now = Date.now()
            if (now - lastScanRef.current < 2000) return
            lastScanRef.current = now

            scanningRef.current = false

            setFlash(true)
            setTimeout(() => setFlash(false), 600)

            try {
              // ── If the QR encodes a 6-digit PIN, use verifyPin (same as manual entry)
              if (/^\d{6}$/.test(scannedText)) {
                setPinLoading(true)
                let lat = null, lng = null
                try {
                  const pos = await new Promise((res, rej) =>
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
                  )
                  lat = pos.coords.latitude
                  lng = pos.coords.longitude
                } catch { }
                try {
                  const data = await rideAPI.verifyPin(scannedText, lat, lng)
                  if (onScan) await onScan('__pin_verified__', data)
                } catch (err) {
                  const msg = err.response?.data?.error || 'Verification failed. Try again.'
                  setPinError(msg)
                  // re-enable camera after error
                  setTimeout(() => { if (!cancelled) scanningRef.current = true }, 1500)
                } finally {
                  setPinLoading(false)
                }
              } else {
                // Fallback: pass raw token to parent (legacy full-token QR)
                if (onScan) await onScan(scannedText)
              }
            } finally {
              // ✅ restart scanning safely
              setTimeout(() => {
                if (!cancelled) {
                  scanningRef.current = true
                }
              }, 800)
            }
          },
          () => { }
        )

        if (!cancelled) setStatus('scanning')
      } catch (e) {
        if (cancelled) return

        const msg = e?.message || 'Camera access denied or not available.'
        setErrMsg(msg)
        setStatus('error')

        if (onError) onError(msg)
      }
    }

    initScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [active, onError, normalizeDecodedText, onScan]) // ✅ prevent unnecessary re-init

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(val)
    if (pinError) setPinError('')
  }

  const handlePinVerify = async () => {
    if (pin.length < 6) {
      setPinError('Please enter the full 6-digit PIN.')
      return
    }

    setPinLoading(true)
    setPinError('')

    let lat = null, lng = null

    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch { }

    try {
      const data = await rideAPI.verifyPin(pin, lat, lng)
      setPin('')
      if (onScan) onScan('__pin_verified__', data)
    } catch (err) {
      setPinError(err.response?.data?.error || 'Invalid or expired PIN. Try again.')
    } finally {
      setPinLoading(false)
    }
  }

  const handlePinKeyDown = (e) => {
    if (e.key === 'Enter' && pin.length === 6) handlePinVerify()
  }

  // ── Upload a QR photo and decode it ────────────────────────────────────────
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileLoading(true)
    setFileError('')

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // We need a real DOM element — use the hidden div
      const fileScannerEl = document.getElementById('qr-file-scanner-hidden')
      if (!fileScannerEl) throw new Error('Scanner element missing')

      const reader = new Html5Qrcode('qr-file-scanner-hidden')
      const decoded = await reader.scanFile(file, /* showImage= */ false)
      const scannedText = normalizeDecodedText(decoded)

      // ── If the QR encodes a 6-digit PIN, use verifyPin
      if (/^\d{6}$/.test(scannedText)) {
        setPinLoading(true)
        try {
          let lat = null, lng = null
          try {
            const pos = await new Promise((res, rej) =>
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
            )
            lat = pos.coords.latitude
            lng = pos.coords.longitude
          } catch { }
          const data = await rideAPI.verifyPin(scannedText, lat, lng)
          if (onScan) await onScan('__pin_verified__', data)
        } catch (err) {
          const msg = err.response?.data?.error || 'Verification failed. Try again.'
          setFileError(msg)
        } finally {
          setPinLoading(false)
        }
      } else if (onScan && scannedText) {
        await onScan(scannedText)
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Could not read QR from image. Try a clearer photo or better lighting.'
      setFileError(msg)
    } finally {
      setFileLoading(false)
      // Reset so same file can be picked again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [normalizeDecodedText, onScan])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>QR SCANNER</div>
        <div style={{ ...styles.statusBadge, ...(status === 'scanning' ? styles.statusActive : {}) }}>
          <span className="status-dot" style={status === 'scanning' ? { animation: 'blink 1s infinite' } : {}} />
          {status === 'initializing' ? 'INIT...' : status === 'scanning' ? 'LIVE' : status === 'error' ? 'ERROR' : 'PAUSED'}
        </div>
      </div>

      {/* Camera */}
      {status === 'error' ? (
        <div style={styles.errorState}>
          <div style={styles.errorIcon}>⊘</div>
          <div style={styles.errorTitle}>Camera Unavailable</div>
          <div style={styles.errorMsg}>{errMsg}</div>
          <div style={styles.errorSteps}>
            <div style={styles.errorStepTitle}>To enable camera:</div>
            <div style={styles.errorStep}>① Click the camera icon in your browser's address bar</div>
            <div style={styles.errorStep}>② Select <strong>Allow</strong> for camera access</div>
            <div style={styles.errorStep}>③ Click Retry below</div>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={styles.retryBtn}
          >
            ↺ Retry Camera
          </button>
          <div style={styles.errorHint}>Or use the PIN entry below instead.</div>
        </div>
      ) : (
        <div style={styles.scannerWrap}>
          <div
            id="qr-scanner-container"
            style={{ ...styles.scannerDiv, ...(flashActive ? styles.flashOverlay : {}) }}
          />
          {['tl', 'tr', 'bl', 'br'].map(pos => (
            <div key={pos} style={{ ...styles.corner, ...cornerPos[pos] }} />
          ))}
          {/* Only show overlay when NOT actively scanning */}
          {status !== 'scanning' && (
            <div style={styles.overlay}>
              {status === 'initializing' && <div className="loader loader-white" />}
              <div style={styles.overlayText}>
                {status === 'paused' ? 'Scanner paused' : 'Starting camera...'}
              </div>
            </div>
          )}
          {/* Subtle live indicator when scanning */}
          {status === 'scanning' && (
            <div style={styles.liveHint}>
              📷 Point at rider's QR code
            </div>
          )}
        </div>
      )}

      {/* Hidden div required by html5-qrcode scanFile() */}
      <div id="qr-file-scanner-hidden" style={{ display: 'none' }} />

      {/* Upload QR Photo button */}
      <div style={styles.uploadRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          id="qr-file-input"
        />
        <button
          id="upload-qr-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={fileLoading}
          style={styles.uploadBtn}
        >
          {fileLoading
            ? <span className="loader loader-white" style={{ width: 13, height: 13 }} />
            : '⬆ Upload QR Photo'}
        </button>
        <div style={styles.uploadHint}>Can't scan live? Upload a photo of the QR code</div>
      </div>
      {fileError && <div style={styles.fileError}>{fileError}</div>
      }

      <div style={styles.instructions}>
        <div style={styles.instrLine}>⊡ Scan live with camera — or upload a QR photo above</div>
        <div style={styles.instrLine}>⊟ Or enter the 6-digit PIN below</div>
      </div>

      {/* ── PIN Entry ── */}
      <div style={styles.pinSection}>
        <div style={styles.pinLabel}>Enter Rider PIN</div>

        <div style={styles.pinRow}>
          <input
            id="pin-input"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handlePinChange}
            onKeyDown={handlePinKeyDown}
            placeholder="6-digit PIN"
            maxLength={6}
            style={{
              ...styles.pinInput,
              borderColor: pinError ? '#000' : '#ccc',
            }}
            autoComplete="one-time-code"
          />
          <button
            id="pin-verify-btn"
            onClick={handlePinVerify}
            disabled={pin.length < 6 || pinLoading}
            style={{
              ...styles.pinBtn,
              opacity: pin.length < 6 ? 0.45 : 1,
              cursor: pin.length < 6 ? 'not-allowed' : 'pointer',
            }}
            type="button"
          >
            {pinLoading
              ? <span className="loader loader-white" style={{ width: 14, height: 14 }} />
              : 'Verify'
            }
          </button>
        </div>

        {pinError && <div style={styles.pinError}>{pinError}</div>}

        <div style={styles.pinHint}>PIN expires in 45s — ask rider to refresh if it fails.</div>
      </div>
    </div>
  )
}

const cornerPos = {
  tl: { top: 0,    left: 0,   borderTop: '3px solid #fff', borderLeft:  '3px solid #fff' },
  tr: { top: 0,    right: 0,  borderTop: '3px solid #fff', borderRight: '3px solid #fff' },
  bl: { bottom: 0, left: 0,   borderBottom: '3px solid #fff', borderLeft:  '3px solid #fff' },
  br: { bottom: 0, right: 0,  borderBottom: '3px solid #fff', borderRight: '3px solid #fff' },
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    fontFamily: 'Space Mono, monospace',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: {
    fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em',
    padding: '4px 10px', border: '1px solid #ccc', textTransform: 'uppercase',
    color: '#888',
  },
  statusActive: {
    borderColor: '#00c853', color: '#00c853',
  },
  scannerWrap: {
    position: 'relative', width: '100%', aspectRatio: '1',
    background: '#111', overflow: 'hidden',
    minHeight: '260px',
  },
  scannerDiv: {
    width: '100%', height: '100%',
  },
  flashOverlay: {
    outline: '4px solid rgba(255,255,255,0.8)',
  },
  corner: {
    position: 'absolute', width: '20px', height: '20px',
  },
  overlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px',
    background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 10,
  },
  overlayText: {
    fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em',
    textAlign: 'center', padding: '0 16px',
  },
  liveHint: {
    position: 'absolute', bottom: '10px', left: 0, right: 0,
    textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Space Mono, monospace', pointerEvents: 'none',
    background: 'rgba(0,0,0,0.4)', padding: '4px 0',
  },
  errorState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '10px', padding: '32px 16px',
    border: '2px solid #000', background: '#f5f5f5', textAlign: 'center',
    minHeight: '200px',
  },
  errorIcon:  { fontSize: '32px', color: '#000' },
  errorTitle: { fontSize: '14px', fontWeight: '700', color: '#000', letterSpacing: '0.05em' },
  errorMsg:   { fontSize: '11px', color: '#444', maxWidth: '260px', fontFamily: 'Space Mono, monospace' },
  errorSteps: { display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', padding: '12px 16px', border: '1px solid #ddd', background: '#fff', width: '100%', boxSizing: 'border-box' },
  errorStepTitle: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px', color: '#000' },
  errorStep:  { fontSize: '11px', color: '#444', fontFamily: 'Space Mono, monospace', lineHeight: 1.7 },
  retryBtn:   {
    padding: '10px 24px', background: '#000', color: '#fff',
    border: '2px solid #000', fontFamily: 'Space Mono, monospace',
    fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em',
    cursor: 'pointer', marginTop: '4px',
  },
  errorHint:  { fontSize: '10px', color: '#888', marginTop: '2px' },
  instructions: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    paddingTop: '8px', borderTop: '1px solid #e8e8e8',
  },
  instrLine: {
    fontSize: '11px', color: '#888',
  },
  pinSection: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    paddingTop: '12px', borderTop: '2px solid #000',
  },
  pinLabel: {
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  pinRow: {
    display: 'flex', gap: '8px',
  },
  pinInput: {
    flex: 1, padding: '10px 12px',
    fontFamily: 'Space Mono, monospace', fontSize: '18px',
    letterSpacing: '0.2em', textAlign: 'center',
    border: '2px solid #ccc', outline: 'none',
    transition: 'border-color 0.15s',
  },
  pinBtn: {
    padding: '10px 18px',
    fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700',
    background: '#000', color: '#fff', border: '2px solid #000',
    letterSpacing: '0.05em', transition: 'opacity 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '72px',
  },
  pinError: {
    fontSize: '11px', color: '#333', fontWeight: '700',
    fontFamily: 'Space Mono, monospace',
  },
  pinHint: {
    fontSize: '10px', color: '#aaa',
  },
  // ── Upload QR photo ──────────────────────────────────────────────────────────
  uploadRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', border: '1px dashed #bbb', background: '#fafafa',
  },
  uploadBtn: {
    padding: '8px 14px', flexShrink: 0,
    fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700',
    background: '#000', color: '#fff', border: '2px solid #000',
    letterSpacing: '0.04em', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  uploadHint: {
    fontSize: '10px', color: '#888', fontFamily: 'Space Mono, monospace', lineHeight: 1.5,
  },
  fileError: {
    padding: '8px 12px', border: '1px solid #000', background: '#f5f5f5',
    fontFamily: 'Space Mono, monospace', fontSize: '11px', fontWeight: '700', color: '#333',
  },
}