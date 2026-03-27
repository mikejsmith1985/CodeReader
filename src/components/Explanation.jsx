const LOADING_MESSAGES = [
  "Let me read this for you...",
  "Studying the code...",
  "Translating code to English...",
  "Making sense of this...",
  "Breaking this down...",
]

const DEPTH_LABELS = {
  1: "Here's what this file does:",
  2: "Here's how this file is organized:",
  3: "Here's how this code works:",
  4: "Line-by-line breakdown:",
}

export default function Explanation({ text, loading, noAI, depth }) {
  if (loading) {
    const msg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🤖</div>
        <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 500 }}>{msg}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>This usually takes a few seconds</div>
      </div>
    )
  }

  if (!text) return null

  const isOverview = depth <= 2

  return (
    <div className="slide-up" style={{
      background: 'var(--surface)',
      border: `1px solid ${noAI ? 'var(--warning)' : 'var(--accent)'}`,
      borderRadius: 'var(--radius)',
      padding: isOverview ? 28 : 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: isOverview ? 24 : 18 }}>🤖</span>
        <span style={{ fontWeight: 600, fontSize: isOverview ? 16 : 14 }}>
          {DEPTH_LABELS[depth] || 'AI Explanation'}
        </span>
        {noAI && (
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'rgba(210,153,34,0.15)',
            color: 'var(--warning)',
          }}>
            No AI configured — basic mode
          </span>
        )}
      </div>
      <div style={{
        color: 'var(--text)',
        fontSize: isOverview ? 16 : 14,
        lineHeight: 1.9,
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </div>
  )
}
