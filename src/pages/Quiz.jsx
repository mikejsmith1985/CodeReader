import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import QuizCard from '../components/QuizCard'
import { useProgress } from '../hooks/useProgress'

export default function Quiz({ onProgress }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // New params: owner, repo, path
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const pathParam = searchParams.get('path')
  const filePath = owner && repo && pathParam ? `${owner}/${repo}/${pathParam}` : searchParams.get('file')

  const depth = parseInt(searchParams.get('depth')) || 3
  const blockIndex = parseInt(searchParams.get('block')) || 0

  const [questions, setQuestions] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)

  const progress = useProgress()

  useEffect(() => {
    if (!filePath) return

    // Retrieve code + explanation stored by CodeExplorer before navigating here
    let code = ''
    let explanation = ''
    try {
      const ctx = sessionStorage.getItem('quiz_context')
      if (ctx) {
        const parsed = JSON.parse(ctx)
        code = parsed.code || ''
        explanation = parsed.explanation || ''
        sessionStorage.removeItem('quiz_context') // consume once
      }
    } catch (e) { /* ignore */ }

    // Fallback: code from URL param (legacy)
    if (!code) code = searchParams.get('code') || ''

    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, code, explanation, depth, blockIndex }),
    })
      .then(r => r.json())
      .then(data => {
        setQuestions(data.questions || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [filePath])

  const handleAnswer = (isCorrect) => {
    const newScore = {
      correct: score.correct + (isCorrect ? 1 : 0),
      total: score.total + 1,
    }
    setScore(newScore)

    setTimeout(async () => {
      if (currentQ + 1 >= (questions?.length || 0)) {
        setFinished(true)
        const result = await progress.submitQuiz(filePath, newScore.correct, newScore.total)
        if (result) onProgress?.(result)
      } else {
        setCurrentQ(currentQ + 1)
      }
    }, 1500)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>❓</div>
        <div style={{ color: 'var(--text-secondary)' }}>Generating quiz...</div>
      </div>
    )
  }

  if (!questions || questions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😢</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Couldn't generate a quiz for this code.</div>
        <button className="btn-primary" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    )
  }

  if (finished) {
    const percent = Math.round((score.correct / score.total) * 100)
    const isPerfect = percent === 100
    const passed = percent >= 60
    const baseXP = score.correct * 10
    const passBonus = passed ? 25 : 0
    const perfectBonus = isPerfect ? 25 : 0
    const totalXP = baseXP + passBonus + perfectBonus

    return (
      <div className="slide-up" style={{
        maxWidth: 500,
        margin: '0 auto',
        textAlign: 'center',
        padding: 40,
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {isPerfect ? '🏆' : passed ? '⚔️' : '📚'}
        </div>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>
          {isPerfect ? 'Boss Defeated! PERFECT!' : passed ? 'Boss Defeated!' : 'Boss Fight Failed — Try Again!'}
        </h2>
        <div style={{
          fontSize: 48, fontWeight: 700, marginBottom: 8,
          background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {score.correct}/{score.total}
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          {isPerfect ? 'Flawless victory! 🎯' : passed ? 'Great work — you understood it!' : 'Keep reading and try the boss again.'}
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          lineHeight: 1.8,
        }}>
          <div style={{ color: 'var(--text-secondary)' }}>🎯 {score.correct} correct × 10 = <strong style={{ color: 'var(--text)' }}>{baseXP} XP</strong></div>
          {passed && <div style={{ color: 'var(--text-secondary)' }}>✅ Passed bonus = <strong style={{ color: 'var(--success)' }}>+{passBonus} XP</strong></div>}
          {isPerfect && <div style={{ color: 'var(--text-secondary)' }}>🏆 Perfect score bonus = <strong style={{ color: '#f59e0b' }}>+{perfectBonus} XP</strong></div>}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>
            Total: +{totalXP} XP
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => navigate(-1)}>
            ← Continue Learning
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 18 }}>⚔️ Boss Fight</h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Question {currentQ + 1} of {questions.length} · Score: {score.correct}/{score.total}
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i < currentQ ? 'var(--success)' : i === currentQ ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      <QuizCard
        key={currentQ}
        question={questions[currentQ]}
        onAnswer={handleAnswer}
      />
    </div>
  )
}
