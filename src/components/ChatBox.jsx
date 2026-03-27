import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STARTER_QUESTIONS = [
  "What does this file do?",
  "I don't understand — can you explain it differently?",
  "What's the most important part?",
  "Can you give me a real-world analogy?",
  "Why would someone write this code?",
]

export default function ChatBox({ code, filename, project, description }) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  const send = async (question) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const optimistic = { question: q, answer: null }
    setHistory(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          code,
          filename,
          project,
          description,
          history: history.filter(h => h.answer), // only completed turns
        }),
      })
      const data = await res.json()
      setHistory(prev => prev.map((h, i) =>
        i === prev.length - 1 ? { ...h, answer: data.answer || data.error, action: data.action, actionLabel: data.actionLabel } : h
      ))
    } catch (e) {
      setHistory(prev => prev.map((h, i) =>
        i === prev.length - 1 ? { ...h, answer: 'Network error: ' + e.message } : h
      ))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>💬</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Ask the AI anything</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          It knows what file you're looking at
        </span>
      </div>

      {/* Starter prompts (only when no history) */}
      {history.length === 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Not sure what to ask? Try one of these:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STARTER_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                style={{
                  padding: '5px 12px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div style={{
          maxHeight: 400,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {history.map((msg, i) => (
            <div key={i}>
              {/* User question */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <div style={{
                  background: 'var(--accent)',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '16px 16px 4px 16px',
                  fontSize: 14,
                  maxWidth: '80%',
                  lineHeight: 1.5,
                }}>
                  {msg.question}
                </div>
              </div>
              {/* AI answer */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>🤖</span>
                <div style={{
                  background: 'var(--card)',
                  border: `1px solid ${msg.action === 'setup' ? '#f59e0b' : 'var(--border)'}`,
                  padding: '10px 14px',
                  borderRadius: '4px 16px 16px 16px',
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: msg.answer ? 'var(--text)' : 'var(--text-secondary)',
                  maxWidth: '85%',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.answer
                    ? <>
                        {msg.answer}
                        {msg.action === 'setup' && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => navigate('/setup')}
                              style={{
                                padding: '6px 14px',
                                background: '#f59e0b',
                                color: '#1a1a1a',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {msg.actionLabel || 'Fix in Settings ⚙️'}
                            </button>
                          </div>
                        )}
                      </>
                    : <span style={{ animation: 'pulse 1.2s infinite' }}>Thinking...</span>
                  }
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: history.length > 0 ? '1px solid var(--border)' : 'none',
        display: 'flex',
        gap: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about this code..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px',
            background: loading || !input.trim() ? 'var(--card)' : 'var(--accent)',
            color: loading || !input.trim() ? 'var(--text-secondary)' : 'white',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '...' : 'Ask ↵'}
        </button>
      </div>
    </div>
  )
}
