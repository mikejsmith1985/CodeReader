import { useState, useCallback } from 'react'

export function useProgress() {
  const [loading, setLoading] = useState(false)

  const completeExplanation = useCallback(async (filePath, depth, blockIndex = -1) => {
    setLoading(true)
    try {
      const res = await fetch('/api/progress/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, depth, blockIndex, xpGained: 2 }),
      })
      return await res.json()
    } finally { setLoading(false) }
  }, [])

  const submitQuiz = useCallback(async (filePath, correct, total) => {
    setLoading(true)
    try {
      const res = await fetch('/api/progress/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, correct, total }),
      })
      return await res.json()
    } finally { setLoading(false) }
  }, [])

  const completeGoal = useCallback(async (filePath, depth, goalIndex) => {
    setLoading(true)
    try {
      const res = await fetch('/api/goals/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, depth, goalIndex }),
      })
      return await res.json()
    } finally { setLoading(false) }
  }, [])

  return { completeExplanation, submitQuiz, completeGoal, loading }
}
