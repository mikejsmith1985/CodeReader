import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import CodeExplorer from './pages/CodeExplorer'
import Quiz from './pages/Quiz'
import Achievements from './pages/Achievements'
import SetupWizard from './pages/SetupWizard'
import AchievementToast from './components/AchievementToast'

function App() {
  const location = useLocation()
  const [progress, setProgress] = useState(null)
  const [toasts, setToasts] = useState([])

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/progress')
      const data = await res.json()
      setProgress(data)
    } catch (e) { console.error('Failed to fetch progress:', e) }
  }

  useEffect(() => { fetchProgress() }, [location.pathname])

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 24 }}>🧠</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>CodeReader</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {progress && (
            <>
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
                <span style={{ color: 'var(--text-secondary)' }}>{progress.levelName}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress.xp} XP</span>
              </div>
              <Link to="/achievements" style={{
                fontSize: 20,
                textDecoration: 'none',
                opacity: location.pathname === '/achievements' ? 1 : 0.6,
                transition: 'opacity 0.2s',
              }}>🏆</Link>
              <Link to="/setup" style={{
                fontSize: 20,
                textDecoration: 'none',
                opacity: location.pathname === '/setup' ? 1 : 0.6,
                transition: 'opacity 0.2s',
              }} title="AI Setup">⚙️</Link>
            </>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Routes>
          <Route path="/" element={<Dashboard progress={progress} />} />
          <Route path="/project/:id" element={<ProjectView />} />
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

export default App
