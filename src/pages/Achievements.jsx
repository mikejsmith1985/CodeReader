import { useState, useEffect } from 'react'

export default function Achievements() {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/achievements')
      .then(r => r.json())
      .then(data => {
        setAchievements(data.achievements || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, animation: 'pulse 1.5s infinite' }}>🏆</div>
      </div>
    )
  }

  const unlocked = achievements.filter(a => a.unlocked)
  const locked = achievements.filter(a => !a.unlocked)

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>🏆 Achievements</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        {unlocked.length} of {achievements.length} unlocked
      </p>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, color: 'var(--warning)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Unlocked
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {unlocked.map(a => (
              <div key={a.id} style={{
                background: 'linear-gradient(135deg, var(--card), rgba(210,153,34,0.1))',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius)',
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{ fontSize: 32 }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Locked
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {locked.map(a => (
              <div key={a.id} style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: 0.5,
              }}>
                <span style={{ fontSize: 32, filter: 'grayscale(1)' }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
