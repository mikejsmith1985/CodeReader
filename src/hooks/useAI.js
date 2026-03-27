import { useState } from 'react'

export function useAI() {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [error, setError] = useState(null)

  const explain = async (filePath, code, depth, blockIndex, project, description) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, code, depth, blockIndex, project, description }),
      })
      const data = await res.json()
      setExplanation(data.explanation)
      return data
    } catch (e) {
      setError(e.message)
      return null
    } finally { setLoading(false) }
  }

  const getQuiz = async (filePath, code, explanationText, depth, blockIndex) => {
    setLoading(true)
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, code, explanation: explanationText, depth, blockIndex }),
      })
      return await res.json()
    } finally { setLoading(false) }
  }

  return { explain, getQuiz, explanation, loading, error }
}
