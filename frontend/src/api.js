import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gasv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gasv_token');
      localStorage.removeItem('gasv_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then(r => r.data),
  me: () =>
    api.get('/auth/me').then(r => r.data),
};

export const rideAPI = {
  // ── Rider actions ──────────────────────────────────────────────────────────
  // Rider creates the ride
  createRide: (pickup, destination) =>
    api.post('/rides', { pickup, destination }).then(r => r.data),
  // Rider checks their active ride
  getRiderActiveRide: () =>
    api.get('/rides/rider/active').then(r => r.data),
  // Rider generates QR for a ride
  generateQR: (rideId) =>
    api.post(`/rides/${rideId}/qr`).then(r => r.data),

  // ── Driver actions ─────────────────────────────────────────────────────────
  // Driver scans & verifies full QR token (camera scan)
  verifyQR: (qrToken, lat, lng) =>
    api.post('/rides/verify', { qrToken, lat, lng }).then(r => r.data),
  // Driver verifies via short 6-char PIN (verbal / manual fallback)
  verifyPin: (pin, lat, lng) =>
    api.post('/rides/verify-pin', { pin, lat, lng }).then(r => r.data),
  // Driver checks the ride they have accepted
  getDriverActiveRide: () =>
    api.get('/rides/driver/active').then(r => r.data),
  // Driver starts the ride
  startRide: (rideId) =>
    api.post(`/rides/${rideId}/start`).then(r => r.data),
  // Driver completes the ride
  completeRide: (rideId) =>
    api.post(`/rides/${rideId}/complete`).then(r => r.data),
};

export default api;
