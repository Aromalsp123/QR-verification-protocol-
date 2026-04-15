const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// ─── SECRETS ────────────────────────────────────────────────────────────────
const JWT_SECRET   = process.env.JWT_SECRET   || 'gasv-jwt-secret-change-in-prod';
const QR_SECRET    = process.env.QR_SECRET    || 'gasv-qr-hmac-secret-change-in-prod';
const QR_EXPIRY_MS = 45_000; // 45 seconds

// ─── IN-MEMORY STORES ────────────────────────────────────────────────────────
const users      = new Map();
const rides      = new Map();
const usedTokens = new Set();  // Replay-attack prevention
const pins       = new Map();  // short PIN → { qrToken, expiresAt }
const verifyLogs = [];

// ─── SEED USERS ──────────────────────────────────────────────────────────────
const seedUsers = [
  { id: 'driver-001', username: 'driver1', password: 'driver123', name: 'Rajan Kumar',  role: 'driver', vehicle: 'KL-01 AB 1234', rating: 4.8 },
  { id: 'driver-002', username: 'driver2', password: 'driver123', name: 'Suresh Nair',  role: 'driver', vehicle: 'KL-02 CD 5678', rating: 4.6 },
  { id: 'rider-001',  username: 'rider1',  password: 'rider123',  name: 'Priya Menon',  role: 'rider',  rating: 4.9 },
  { id: 'rider-002',  username: 'rider2',  password: 'rider123',  name: 'Anil Thomas',  role: 'rider',  rating: 4.7 },
];
seedUsers.forEach((u) => users.set(u.username, u));

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authorization token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role)
    return res.status(403).json({ error: `Access denied. Requires ${role} role.` });
  next();
};

// Generate HMAC-signed QR payload (riderId binds the token to this rider)
const generateQRPayload = (rideId, riderId) => {
  const nonce     = crypto.randomBytes(12).toString('hex');
  const timestamp = Date.now();
  const raw       = `${rideId}:${riderId}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
  return { rideId, riderId, timestamp, nonce, signature };
};

// Verify an HMAC-signed payload object
const verifyQRPayload = (payload) => {
  const { rideId, riderId, timestamp, nonce, signature } = payload || {};

  if (!rideId || !riderId || !timestamp || !nonce || !signature)
    return { valid: false, reason: 'Malformed QR token' };

  if (Date.now() - timestamp > QR_EXPIRY_MS)
    return { valid: false, reason: 'QR code expired. Ask rider to refresh.' };

  const tokenKey = `${rideId}:${nonce}`;
  if (usedTokens.has(tokenKey))
    return { valid: false, reason: 'Replay attack detected. This token was already used.' };

  const raw      = `${rideId}:${riderId}:${timestamp}:${nonce}`;
  const expected = crypto.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
  if (signature !== expected)
    return { valid: false, reason: 'Signature invalid. Possible tampering detected.' };

  return { valid: true, tokenKey };
};

// Generate a 6-digit numeric PIN (like a normal OTP)
const generateShortPin = () => {
  let pin = '';
  for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10).toString();
  return pin;
};

// Core verify logic — shared by both QR-scan and PIN paths
const doVerify = (qrToken, driverUser, lat, lng, res) => {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(qrToken, 'base64url').toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed token' });
  }

  const result = verifyQRPayload(payload);
  if (!result.valid) {
    console.warn(`[VERIFY] FAILED for driver ${driverUser.name}: ${result.reason}`);
    return res.status(400).json({ error: result.reason });
  }

  const ride = rides.get(payload.rideId);
  if (!ride)                          return res.status(404).json({ error: 'Ride not found' });
  if (ride.riderId !== payload.riderId) return res.status(400).json({ error: 'Token does not match this ride' });
  if (ride.status === 'completed')    return res.status(400).json({ error: 'Ride already completed' });
  if (ride.status === 'started')      return res.status(400).json({ error: 'Ride already started' });
  if (ride.status === 'verified')     return res.status(400).json({ error: 'Ride already verified' });

  usedTokens.add(result.tokenKey);
  ride.status     = 'verified';
  ride.driverId   = driverUser.id;
  ride.driverName = driverUser.name;
  ride.verifiedAt = Date.now();

  verifyLogs.push({ rideId: ride.id, riderName: ride.riderName, driverName: driverUser.name, timestamp: Date.now(), lat, lng });

  console.log(`[VERIFY] SUCCESS: Driver ${driverUser.name} verified ride ${ride.id} for rider ${ride.riderName}`);
  return res.json({
    success: true,
    message: `Verification successful! You are now assigned to ride for ${ride.riderName}.`,
    ride: {
      id: ride.id,
      riderName: ride.riderName,
      driverName: driverUser.name,
      pickup: ride.pickup,
      destination: ride.destination,
      status: ride.status,
      verifiedAt: ride.verifiedAt,
    },
  });
};

const getRiderActiveRide = (riderId) =>
  [...rides.values()].find((r) => r.riderId === riderId && ['waiting', 'verified', 'started'].includes(r.status)) || null;

const getDriverActiveRide = (driverId) =>
  [...rides.values()].find((r) => r.driverId === driverId && ['verified', 'started'].includes(r.status)) || null;

// ─── ROUTES ──────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'GASV Ride Verify', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = users.get(username);
  if (!user || user.password !== password)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: user.id, name: user.name, role: user.role, vehicle: user.vehicle, rating: user.rating } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.get(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: user.id, name: user.name, role: user.role, vehicle: user.vehicle, rating: user.rating } });
});

// ─── RIDER ROUTES ─────────────────────────────────────────────────────────────

// Rider creates the ride
app.post('/api/rides', authMiddleware, requireRole('rider'), (req, res) => {
  const { pickup, destination } = req.body;

  for (const [id, ride] of rides.entries()) {
    if (ride.riderId === req.user.id && ['waiting', 'verified', 'started'].includes(ride.status)) {
      rides.delete(id);
    }
  }

  const rideId = uuidv4();
  const ride = {
    id: rideId,
    riderId: req.user.id,
    riderName: req.user.name,
    pickup: pickup || 'Current Location',
    destination: destination || 'Destination',
    status: 'waiting',
    createdAt: Date.now(),
    verifiedAt: null,
    startedAt: null,
    completedAt: null,
    driverId: null,
    driverName: null,
  };

  rides.set(rideId, ride);
  console.log(`[RIDE] Created: ${rideId} by rider ${req.user.name}`);
  res.status(201).json({ ride });
});

// Rider checks their active ride
app.get('/api/rides/rider/active', authMiddleware, requireRole('rider'), (req, res) => {
  const ride = getRiderActiveRide(req.user.id);
  res.json({ ride });
});

// Rider generates QR + short PIN for their ride
app.post('/api/rides/:rideId/qr', authMiddleware, requireRole('rider'), (req, res) => {
  const ride = rides.get(req.params.rideId);
  if (!ride)                          return res.status(404).json({ error: 'Ride not found' });
  if (ride.riderId !== req.user.id)   return res.status(403).json({ error: 'Not your ride' });
  if (!['waiting', 'verified'].includes(ride.status))
    return res.status(400).json({ error: 'QR can only be generated before the ride starts' });

  const payload  = generateQRPayload(ride.id, req.user.id);
  const qrToken  = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const expiresAt = payload.timestamp + QR_EXPIRY_MS;

  // Generate a short human-readable PIN that maps to this QR token
  const pin = generateShortPin();
  // Remove any previously active pin for this ride
  for (const [p, v] of pins.entries()) {
    if (v.rideId === ride.id) pins.delete(p);
  }
  pins.set(pin, { qrToken, expiresAt, rideId: ride.id });

  console.log(`[QR] Generated for ride ${ride.id} | PIN: ${pin}`);
  res.json({ qrToken, pin, expiresAt, expiresIn: QR_EXPIRY_MS / 1000 });
});

// ─── DRIVER ROUTES ────────────────────────────────────────────────────────────

// Driver verifies via scanned QR token (base64url)
app.post('/api/rides/verify', authMiddleware, requireRole('driver'), (req, res) => {
  const { qrToken, lat, lng } = req.body;
  if (!qrToken) return res.status(400).json({ error: 'QR token required' });
  doVerify(qrToken, req.user, lat, lng, res);
});

// Driver verifies via short PIN (human-readable alternative)
app.post('/api/rides/verify-pin', authMiddleware, requireRole('driver'), (req, res) => {
  const { pin, lat, lng } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const normalized = pin.trim();
  const record = pins.get(normalized);

  if (!record)
    return res.status(400).json({ error: 'Invalid PIN. Ask rider for the current 6-character code.' });

  if (Date.now() > record.expiresAt) {
    pins.delete(normalized);
    return res.status(400).json({ error: 'PIN expired. Ask rider to refresh their QR code.' });
  }

  // Clean up pin immediately (single-use)
  pins.delete(normalized);
  doVerify(record.qrToken, req.user, lat, lng, res);
});

// Driver checks their active ride
app.get('/api/rides/driver/active', authMiddleware, requireRole('driver'), (req, res) => {
  const ride = getDriverActiveRide(req.user.id);
  res.json({ ride });
});

// Driver starts the ride
app.post('/api/rides/:rideId/start', authMiddleware, requireRole('driver'), (req, res) => {
  const ride = rides.get(req.params.rideId);
  if (!ride)                        return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
  if (ride.status !== 'verified')   return res.status(400).json({ error: 'Ride not verified yet' });

  ride.status    = 'started';
  ride.startedAt = Date.now();
  res.json({ ride });
});

// Driver completes the ride
app.post('/api/rides/:rideId/complete', authMiddleware, requireRole('driver'), (req, res) => {
  const ride = rides.get(req.params.rideId);
  if (!ride)                        return res.status(404).json({ error: 'Ride not found' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Not your ride' });
  if (ride.status !== 'started')    return res.status(400).json({ error: 'Ride not started' });

  ride.status      = 'completed';
  ride.completedAt = Date.now();
  console.log(`[RIDE] Completed: ${ride.id}`);
  res.json({ ride });
});

app.get('/api/rides', authMiddleware, (req, res) => {
  res.json({ rides: [...rides.values()], logs: verifyLogs });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 GASV Backend running on http://localhost:${PORT}`);
  console.log(`\n📋 Test credentials:`);
  console.log(`   Rider  → username: rider1   password: rider123`);
  console.log(`   Driver → username: driver1  password: driver123`);
  console.log(`\n🔐 QR + 6-char PIN expire in ${QR_EXPIRY_MS / 1000}s with HMAC-SHA256 signatures\n`);
});

module.exports = app;
