import { useState, useEffect } from 'react'
import Login from './pages/Login.jsx'
import DriverDashboard from './pages/DriverDashboard.jsx'
import RiderDashboard from './pages/RiderDashboard.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('gasv_user')
    const token  = localStorage.getItem('gasv_token')
    if (stored && token) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  const handleLogin = (user, token) => {
    localStorage.setItem('gasv_token', token)
    localStorage.setItem('gasv_user',  JSON.stringify(user))
    setUser(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('gasv_token')
    localStorage.removeItem('gasv_user')
    setUser(null)
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loader" />
    </div>
  )

  if (!user) return <Login onLogin={handleLogin} />
  if (user.role === 'driver') return <DriverDashboard user={user} onLogout={handleLogout} />
  return <RiderDashboard user={user} onLogout={handleLogout} />
}
