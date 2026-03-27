import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

function useDebounce(fn, delay) {
  const timer = useRef(null)
  return useCallback((...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

export default function AddRepoModal({ onClose, onAdded, existingRepos = [] }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(null)
  const [error, setError] = useState('')

  // Load user's own repos on open
  useEffect(() => {
    setSearching(true)
    fetch('/api/repos/search?q=')
      .then(r => r.json())
      .then(data => { setResults(data.results || []); setSearching(false); })
      .catch(() => setSearching(false))
  }, [])

  const doSearch = useCallback(async (q) => {
    setSearching(true)
    setError('')
    try {
      const res = await fetch(`/api/repos/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setError('Search failed. Check your connection.')
    } finally {
      setSearching(false)
    }
  }, [])

  const debouncedSearch = useDebounce(doSearch, 300)

  const handleInput = (e) => {
    const val = e.target.value
    setQuery(val)
    if (val.trim()) {
      debouncedSearch(val.trim())
    } else {
      // Reset to user's own repos
      doSearch('')
    }
  }

  const handleAdd = async (owner, repo) => {
    const key = `${owner}/${repo}`
    setAdding(key)
    try {
      const res = await fetch('/api/repos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
      })
      if (!res.ok) throw new Error('Failed to add')
      onAdded()
    } catch (e) {
      setError('Failed to add repo. Try again.')
      setAdding(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(560px, calc(100vw - 32px))',
        maxHeight: '80vh',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add a Repo</h2>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ fontSize: 20, padding: '4px 8px', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            type="text"
            placeholder="Search any GitHub repo (e.g. 'facebook/react' or just 'react')…"
            value={query}
            onChange={handleInput}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--error)' }}>{error}</div>
          )}
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {searching && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              Searching…
            </div>
          )}
          {!searching && results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
              {query ? 'No repos found.' : 'No repos in your account.'}
            </div>
          )}
          {!searching && results.map(r => {
            const key = `${r.owner}/${r.repo}`
            const alreadyAdded = existingRepos.includes(key)
            return (
              <div
                key={key}
                style={{
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                      {r.owner}/{r.repo}
                    </span>
                    {r.isPrivate && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
                        private
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                    {r.language && <span>● {r.language}</span>}
                    {r.stargazerCount > 0 && <span>⭐ {r.stargazerCount.toLocaleString()}</span>}
                  </div>
                </div>
                <button
                  onClick={() => !alreadyAdded && handleAdd(r.owner, r.repo)}
                  disabled={alreadyAdded || adding === key}
                  className={alreadyAdded ? 'btn-ghost' : 'btn-primary'}
                  style={{
                    fontSize: 13,
                    padding: '6px 14px',
                    flexShrink: 0,
                    opacity: alreadyAdded ? 0.6 : 1,
                    cursor: alreadyAdded ? 'default' : 'pointer',
                  }}
                >
                  {alreadyAdded ? '✓ Added' : adding === key ? '…' : '+ Add'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
