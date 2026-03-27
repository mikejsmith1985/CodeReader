import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import CodeExplorer from './pages/CodeExplorer'
import Quiz from './pages/Quiz'
import Achievements from './pages/Achievements'
import SetupWizard from './pages/SetupWizard'
import LoginPage from './pages/LoginPage'
import AchievementToast from './components/AchievementToast'
import { AuthProvider, useAuth } from './contexts/AuthContext'

function AppContent() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [progress, setProgress] = useState(null)
  const [toasts, setToasts] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/progress')
      if (!res.ok) return
      const data = await res.json()
      setProgress(data)
    } catch (e) { console.error('Failed to fetch progress:', e) }
  }

  useEffect(() => {
    if (user) fetchProgress()
  }, [location.pathname, user])

  const showAchievement = (achievement) => {
    const id = Date.now()
    setToasts(prev => [...prev, { ...achievement, toastId: id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.toastId !== id)), 4000)
  }

  const handleProgressUpdate = (data) => {
    if (data.newAchievements?.length > 0) {
      data.newAchievements.forEach(a => showAchievement(a))
    }
    setProgress(prev => ({ ...prev, ...data }))
  }

  // Loading state
  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 48, animation: 'pulse 1.5s infinite' }}>🧠</div>
      </div>
    )
  }

  // Not logged in
  if (user === null) {
    return <LoginPage />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mobile Nav Overlay */}
      {drawerOpen && (
        <div
          className="nav-overlay"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile Nav Drawer */}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {user.avatarUrl && (
              <img src={user.avatarUrl} alt={user.username} style={{ width: 36, height: 36, borderRadius: '50%' }} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username}</div>
              {progress && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Lvl {progress.level} · {progress.xp} XP · 🔥 {progress.streak_days}
                </div>
              )}
            </div>
          </div>
        </div>
        <nav style={{ padding: '12px 0' }}>
          {[
            { to: '/', label: '🏠 Home' },
            { to: '/achievements', label: '🏆 Achievements' },
            { to: '/setup', label: '⚙️ AI Setup' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setDrawerOpen(false)}
              style={{
                display: 'block',
                padding: '12px 20px',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 15,
                fontWeight: location.pathname === to ? 600 : 400,
                background: location.pathname === to ? 'var(--card)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <button
            onClick={() => { logout(); setDrawerOpen(false); }}
            className="btn-secondary"
            style={{ width: '100%' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Nav Bar */}
      <nav style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hamburger */}
          <button
            className="hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ fontSize: 24 }}>🧠</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>CodeReader</span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {progress && (
            <div className="nav-stats">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <span>🔥</span>
                <span style={{ color: progress.streak_days > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  {progress.streak_days || 0}
                </span>
              </div>
              <div style={{
                background: 'var(--card)',
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--purple)' }}>Lvl {progress.level}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress.xp} XP</span>
              </div>
              <Link to="/achievements" style={{
                fontSize: 20,
                textDecoration: 'none',
                opacity: location.pathname === '/achievements' ? 1 : 0.6,
                transition: 'opacity 0.2s',
              }}>🏆</Link>
            </div>
          )}

          {/* User avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.username}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)' }}
              />
            )}
            <button
              onClick={logout}
              className="btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Routes>
          <Route path="/" element={<Dashboard progress={progress} />} />
          <Route path="/project/:owner/:repo" element={<ProjectView />} />
          <Route path="/learn" element={
            <CodeExplorer onProgress={handleProgressUpdate} />
          } />
          <Route path="/quiz" element={
            <Quiz onProgress={handleProgressUpdate} />
          } />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/setup" element={<SetupWizard />} />
        </Routes>
      </main>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <AchievementToast key={t.toastId} achievement={t} />
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
