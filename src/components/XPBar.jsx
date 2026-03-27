import { getXPProgress } from '../utils/xp'

export default function XPBar({ xp = 0 }) {
  const { percent, current, next } = getXPProgress(xp)

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: current.color, fontWeight: 600 }}>
          Lvl {current.level} {current.name}
        </span>
        {next && (
          <span style={{ color: 'var(--text-secondary)' }}>
            {xp} / {next.minXP} XP
          </span>
        )}
      </div>
      <div style={{
        height: 8,
        background: 'var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          background: 'var(--gradient)',
          borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
