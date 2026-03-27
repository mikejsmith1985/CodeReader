export default function AchievementToast({ achievement }) {
  return (
    <div className="toast toast-achievement">
      <span style={{ fontSize: 32 }}>{achievement.icon}</span>
      <div>
        <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{achievement.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{achievement.description}</div>
      </div>
    </div>
  )
}
