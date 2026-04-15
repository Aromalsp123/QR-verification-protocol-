# QRV Protocol — Ride Verification MVP

**QR Verification** — A zero-OTP, QR-based ride authentication system.

No secrets shared over voice. No social engineering possible. Tokens die in 45 seconds.

---

## Project Structure

```
ride-verify-mvp/
├── backend/          → Node.js + Express API
│   └── server.js     → All routes, HMAC signing, verification logic
└── frontend/         → React + Vite UI
    └── src/
        ├── pages/
        │   ├── Login.jsx            → Role-based login (driver/rider)
        │   ├── DriverDashboard.jsx  → Create ride, display QR, track status
        │   └── RiderDashboard.jsx   → Scan QR, verify ride, view details
        └── components/
            ├── QRDisplay.jsx        → QR with 45s countdown ring
            ├── QRScanner.jsx        → Camera-based QR scanner
            └── VerificationStatus.jsx → Success/failure states
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
npm start
# Server runs at http://localhost:3001
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role   | Username | Password   |
|--------|----------|------------|
| Driver | driver1  | driver123  |
| Driver | driver2  | driver123  |
| Rider  | rider1   | rider123   |
| Rider  | rider2   | rider123   |

---

## 🔒 Security Architecture

### Token Structure
```json
{
  "rideId":    "uuid-of-the-ride",
  "driverId":  "driver-001",
  "timestamp": 1712345678000,
  "nonce":     "a1b2c3d4e5f6a7b8",
  "signature": "hmac-sha256-hex-digest"
}
```

Encoded as **Base64url** and displayed as a QR code.

### Verification Checks (in order)

1. **Malformation Guard** — Token must be valid Base64url JSON
2. **TTL Check** — Token must be < 45 seconds old
3. **Replay Guard** — Nonce stored; reuse rejected immediately
4. **HMAC-SHA256 Signature** — Server recomputes and compares
5. **Ride ID Match** — Token rideId must match a real active ride

### Why it defeats social engineering

| Attack Vector              | GASV Response                              |
|----------------------------|--------------------------------------------|
| Fake driver calls for OTP  | No OTP exists — nothing to share           |
| Screenshot/forward QR      | Expires in 45s; nonce prevents reuse       |
| Tampered QR                | HMAC signature mismatch → rejected         |
| Replay existing valid QR   | Nonce blacklist → blocked immediately      |
| Wrong person scans         | Ride ID binding + server-side ride check   |

---

## 🛠 Tech Stack

| Layer     | Tech                                    |
|-----------|-----------------------------------------|
| Backend   | Node.js, Express, JWT, crypto (built-in)|
| Frontend  | React 18, Vite, qrcode.react            |
| Scanner   | html5-qrcode (camera access)            |
| Signing   | HMAC-SHA256 (Node built-in crypto)      |
| Auth      | JWT (jsonwebtoken)                      |
| Style     | Pure CSS — Black & White only           |

