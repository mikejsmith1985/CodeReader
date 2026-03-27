import { useState } from 'react'

export default function QuizCard({ question, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const answered = selected !== null
  const isCorrect = selected === question.correct

  const handleSelect = (idx) => {
    if (answered) return
    setSelected(idx)
    onAnswer(idx === question.correct)
  }

  return (
    <div className="slide-up" style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 24,
    }}>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: question.codeExcerpt ? 10 : 16, lineHeight: 1.6 }}>
        {question.question}
      </div>

      {question.codeExcerpt && (
        <pre style={{
          margin: '0 0 16px 0',
          padding: '10px 14px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          lineHeight: 1.6,
          overflowX: 'auto',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {question.codeExcerpt}
        </pre>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options.map((opt, i) => {
          let bg = 'var(--card)'
          let borderColor = 'var(--border)'
          let color = 'var(--text)'

          if (answered) {
            if (i === question.correct) {
              bg = 'rgba(63, 185, 80, 0.15)'
              borderColor = 'var(--success)'
              color = 'var(--success)'
            } else if (i === selected && !isCorrect) {
              bg = 'rgba(248, 81, 73, 0.15)'
              borderColor = 'var(--error)'
              color = 'var(--error)'
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-sm)',
                color: color,
                fontSize: 14,
                cursor: answered ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {!answered && (
        <button
          className="btn-ghost"
          onClick={() => setShowHint(!showHint)}
          style={{ marginTop: 12, fontSize: 13 }}
        >
          💡 {showHint ? 'Hide' : 'Show'} Hint
        </button>
      )}

      {showHint && !answered && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(210,153,34,0.1)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--warning)',
          fontSize: 13,
        }}>
          💡 {question.hint}
        </div>
      )}

      {answered && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: isCorrect ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
          borderRadius: 'var(--radius-sm)',
          color: isCorrect ? 'var(--success)' : 'var(--error)',
          fontSize: 14,
          fontWeight: 500,
        }}>
          {isCorrect ? '✅ Correct! +25 XP' : `❌ Not quite. The answer was: ${question.options[question.correct]}`}
        </div>
      )}
    </div>
  )
}
