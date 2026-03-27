export default function StreakCounter({ days = 0 }) {
  const isActive = days > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: isActive ? 'rgba(210, 153, 34, 0.1)' : 'var(--card)',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isActive ? 'var(--warning)' : 'var(--border)'}`,
    }}>
      <span style={{
        fontSize: 24,
        animation: isActive ? 'pulse 2s infinite' : 'none',
      }}>
        🔥
      </span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: isActive ? 'var(--warning)' : 'var(--text-secondary)' }}>
          {days}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          day streak
        </div>
      </div>
    </div>
  )
}
