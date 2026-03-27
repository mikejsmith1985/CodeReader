import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STATES = { idle: 'idle', checking: 'checking', passed: 'passed', failed: 'failed', noAI: 'noAI' }

function Challenge({ goal, index, filePath, code, depth, completed, onPass }) {
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState(completed ? STATES.passed : STATES.idle)
  const [feedback, setFeedback] = useState('')
  const [attempts, setAttempts] = useState(0)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!answer.trim() || status === STATES.checking || status === STATES.passed) return
    setStatus(STATES.checking)

    const res = await fetch('/api/goals/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        challenge: goal.challenge,
        answer,
        filePath,
        depth,
        goalIndex: index,
      }),
    })
    const data = await res.json()
    setFeedback(data.feedback || '')
    setAttempts(prev => prev + 1)

    if (data.noAI) {
      setStatus(STATES.noAI)
    } else if (data.pass) {
      setStatus(STATES.passed)
      onPass?.(data)
    } else {
      setStatus(STATES.failed)
    }
  }

  const handleRetry = () => {
    setStatus(STATES.idle)
    setFeedback('')
    setAnswer('')
  }

  const isDone = status === STATES.passed
  const isNoAI = status === STATES.noAI

  return (
    <div style={{
      padding: '14px 16px',
      background: isDone ? 'rgba(67, 207, 124, 0.08)' : isNoAI ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg)',
      borderRadius: 10,
      border: `1px solid ${isDone ? 'var(--success)' : isNoAI ? '#f59e0b' : status === STATES.failed ? '#ef444444' : 'var(--border)'}`,
      transition: 'all 0.3s',
    }}>
      {/* Challenge question */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{goal.emoji || '🎯'}</span>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: isDone ? 'var(--success)' : 'var(--text)',
          lineHeight: 1.5,
        }}>
          {goal.challenge}
        </div>
        {isDone && <span style={{ fontSize: 18, flexShrink: 0, marginLeft: 'auto' }}>✅</span>}
      </div>

      {/* Hint */}
      {!isDone && !isNoAI && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 30, marginBottom: 10 }}>
          💡 {goal.hint}
        </div>
      )}

      {/* No AI banner */}
      {isNoAI && (
        <div style={{ marginLeft: 30, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#d97706' }}>⚠️ AI needed to grade your answer</span>
          <button
            onClick={() => navigate('/setup')}
            style={{ padding: '5px 12px', background: '#f59e0b', color: '#1a1a1a', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Fix token ⚙️
          </button>
        </div>
      )}

      {/* AI feedback */}
      {feedback && !isNoAI && (
        <div style={{
          marginLeft: 30,
          marginBottom: 10,
          padding: '8px 12px',
          borderRadius: 6,
          background: isDone ? 'rgba(67, 207, 124, 0.12)' : 'rgba(239, 68, 68, 0.08)',
          fontSize: 13,
          color: isDone ? 'var(--success)' : '#ef4444',
          lineHeight: 1.5,
        }}>
          {isDone ? '✅ ' : '❌ '}{feedback}
        </div>
      )}

      {/* Answer input */}
      {!isDone && !isNoAI && (
        <div style={{ marginLeft: 30 }}>
          <textarea
            value={answer}
            onChange={e => { setAnswer(e.target.value); if (status === STATES.failed) setStatus(STATES.idle) }}
            placeholder="Write what you see in the code, in your own words — no wrong answers, just explain it like you'd tell a friend"
            disabled={status === STATES.checking}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
              opacity: status === STATES.checking ? 0.6 : 1,
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit() }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || status === STATES.checking}
              style={{
                padding: '7px 16px',
                background: answer.trim() && status !== STATES.checking ? '#f59e0b' : 'var(--border)',
                color: answer.trim() && status !== STATES.checking ? '#1a1a1a' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: answer.trim() && status !== STATES.checking ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              {status === STATES.checking ? '🤔 Checking…' : 'Check my answer → +5 XP'}
            </button>
            {status === STATES.failed && attempts >= 2 && (
              <button
                onClick={handleRetry}
                style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Try again with fresh eyes
              </button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              Ctrl+Enter to submit
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MiniGoals({ filePath, code, depth, filename, lineCount, onProgress, onCoverageChange }) {
  const [goals, setGoals] = useState(null)
  const [completed, setCompleted] = useState(new Set())
  const [required, setRequired] = useState(2)
  const [loading, setLoading] = useState(true)
  const [passCount, setPassCount] = useState(0)

  useEffect(() => {
    if (!filePath || !code) return
    setLoading(true)
    setGoals(null)
    setCompleted(new Set())
    setPassCount(0)

    fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, code: code?.slice(0, 3000), depth, filename, lineCount }),
    })
      .then(r => r.json())
      .then(data => {
        const goalList = data.goals || []
        const completedSet = new Set(data.completed || [])
        const req = data.required || 2
        setGoals(goalList)
        setCompleted(completedSet)
        setRequired(req)
        const currentPass = completedSet.size
        setPassCount(currentPass)
        // If no goals loaded, don't block the boss fight
        if (goalList.length === 0) {
          onCoverageChange?.(true)
        } else {
          onCoverageChange?.(currentPass >= req)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        onCoverageChange?.(true) // Don't block if goals fail to load
      })
  }, [filePath, depth])

  const handlePass = (goalIndex, data) => {
    setCompleted(prev => {
      const next = new Set([...prev, goalIndex])
      return next
    })
    setPassCount(prev => {
      const next = prev + 1
      onCoverageChange?.(next >= required)
      return next
    })
    onProgress?.(data.progress || data)
  }

  if (loading) {
    return (
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: '14px 18px',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        ⚔️ Generating challenges…
      </div>
    )
  }

  if (!goals || goals.length === 0) return null

  const bossUnlocked = passCount >= required
  const allDone = passCount >= goals.length
  const remaining = Math.max(0, required - passCount)

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      border: `1px solid ${allDone ? 'var(--success)' : bossUnlocked ? '#f59e0b88' : 'var(--border)'}`,
      padding: '18px 20px',
      transition: 'border-color 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>⚔️ Code Reading Challenges</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {passCount * 5} / {goals.length * 5} XP
        </div>
      </div>

      {/* Progress bar toward boss unlock */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: bossUnlocked ? 'var(--success)' : 'var(--text-secondary)' }}>
          <span>{bossUnlocked ? '🔓 Boss Fight unlocked!' : `🔒 Complete ${remaining} more to unlock Boss Fight`}</span>
          <span>{passCount}/{required} required</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (passCount / required) * 100)}%`,
            background: bossUnlocked ? 'var(--success)' : '#f59e0b',
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Read the code above carefully, then answer each challenge in your own words. The AI will check your understanding.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map((goal, i) => (
          <Challenge
            key={i}
            index={i}
            goal={goal}
            filePath={filePath}
            code={code}
            depth={depth}
            completed={completed.has(i)}
            onPass={(data) => handlePass(i, data)}
          />
        ))}
      </div>

      {allDone && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(67, 207, 124, 0.12)',
          borderRadius: 8,
          fontSize: 14,
          color: 'var(--success)',
          textAlign: 'center',
          fontWeight: 600,
        }}>
          🎉 All challenges cleared! You actually read that code. Now go face the Boss! ⚔️
        </div>
      )}
      {bossUnlocked && !allDone && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'rgba(245, 158, 11, 0.08)',
          borderRadius: 8,
          fontSize: 13,
          color: '#d97706',
          textAlign: 'center',
        }}>
          ✅ Enough coverage — Boss Fight is unlocked above! Keep going for full XP.
        </div>
      )}
    </div>
  )
}

