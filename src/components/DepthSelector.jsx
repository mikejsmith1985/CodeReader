import { DEPTH_NAMES } from '../utils/xp'

export default function DepthSelector({ current, onChange, completedDepths = [] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {Object.entries(DEPTH_NAMES).map(([level, info]) => {
        const lvl = parseInt(level)
        const isActive = lvl === current
        const isCompleted = completedDepths.includes(lvl)

        return (
          <button
            key={lvl}
            onClick={() => onChange(lvl)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: isActive ? `${info.color}22` : 'var(--card)',
              border: `1px solid ${isActive ? info.color : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: isActive ? info.color : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              position: 'relative',
            }}
          >
            <span>{info.icon}</span>
            <span>{info.name}</span>
            {isCompleted && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                fontSize: 12,
                background: 'var(--success)',
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
