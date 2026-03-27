import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import XPBar from '../components/XPBar'
import StreakCounter from '../components/StreakCounter'
import AddRepoModal from '../components/AddRepoModal'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard({ progress }) {
  const { user } = useAuth()
  const [repos, setRepos] = useState([])
  const [challenge, setChallenge] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [aiJustConfigured, setAiJustConfigured] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const fetchRepos = async () => {
    const res = await fetch('/api/repos')
    const data = await res.json()
    setRepos(data.repos || [])
  }

  useEffect(() => {
    if (searchParams.get('ai') === 'ready') {
      setAiJustConfigured(true)
      navigate('/', { replace: true })
    }

    Promise.all([
      fetch('/api/repos').then(r => r.json()),
      fetch('/api/daily-challenge').then(r => r.json()),
      fetch('/api/ai-status').then(r => r.json()),
    ]).then(([repoData, challengeData, aiData]) => {
      setRepos(repoData.repos || [])
      setChallenge(challengeData.challenge)
      setAiStatus(aiData)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🧠</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Loading your repos...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header section */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
        {/* XP + Streak */}
        <div style={{
          flex: '1 1 300px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: 20,
          display: 'flex',
          gap: 20,
          alignItems: 'center',
        }}>
          <StreakCounter days={progress?.streak_days || 0} />
          <div style={{ flex: 1 }}>
            <XPBar xp={progress?.xp || 0} />
          </div>
        </div>

        {/* Daily Challenge */}
        {challenge && (
          <Link
            to={`/learn?owner=${challenge.owner}&repo=${challenge.repo}&path=${encodeURIComponent(challenge.filePath.replace(`${challenge.owner}/${challenge.repo}/`, ''))}&depth=1`}
            style={{ textDecoration: 'none', flex: '0 1 340px' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #1c2128, #1a1f2b)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--accent)',
              padding: 20,
              cursor: 'pointer',
              transition: 'all 0.2s',
              animation: 'glow 3s infinite',
              height: '100%',
            }}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                ⚡ Daily Challenge
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
                {challenge.projectIcon} {challenge.fileName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {challenge.projectName} · {challenge.lines} lines · ~2 min
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* AI Success Banner */}
      {aiJustConfigured && (
        <div className="slide-up" style={{
          background: 'rgba(63,185,80,0.1)',
          border: '1px solid rgba(63,185,80,0.4)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--success)', marginBottom: 2 }}>
              AI is now active!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Every file you explore will now get conversational AI explanations.
            </div>
          </div>
        </div>
      )}

      {/* AI Status Banner */}
      {!aiJustConfigured && aiStatus && aiStatus.status !== 'working' && (
        <Link to="/setup" style={{ textDecoration: 'none' }}>
          <div style={{
            background: aiStatus.status === 'not_configured' ? 'rgba(88,166,255,0.06)' : 'rgba(210,153,34,0.08)',
            border: `1px solid ${aiStatus.status === 'not_configured' ? 'rgba(88,166,255,0.3)' : 'rgba(210,153,34,0.3)'}`,
            borderRadius: 'var(--radius)',
            padding: '14px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span style={{ fontSize: 28 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {aiStatus.status === 'not_configured' ? 'Unlock AI-powered explanations (free!)' : 'Fix AI token setup'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {aiStatus.status === 'not_configured'
                  ? 'Get a free GitHub token and let AI explain your code in plain English.'
                  : 'Your token needs updating. Click to run the setup wizard.'}
              </div>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
              Set up →
            </span>
          </div>
        </Link>
      )}

      {/* Repos section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Your Repos</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {repos.length} repo{repos.length !== 1 ? 's' : ''} added
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          + Add Repo
        </button>
      </div>

      {/* Repo Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {repos.map(r => (
          <Link
            key={`${r.owner}/${r.repo}`}
            to={`/project/${r.owner}/${r.repo}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 20,
              transition: 'all 0.2s',
              cursor: 'pointer',
              height: '100%',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{r.owner}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{r.repo}</div>
                </div>
                {r.isPrivate && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
                    private
                  </span>
                )}
              </div>
              {r.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {r.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                {r.language && <span>● {r.language}</span>}
                {r.stargazerCount > 0 && <span>⭐ {r.stargazerCount}</span>}
              </div>
            </div>
          </Link>
        ))}

        {/* Add repo card */}
        <div
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'transparent',
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 140,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'rgba(88,166,255,0.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: 28 }}>+</span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Add a repo</span>
        </div>
      </div>

      {/* Add Repo Modal */}
      {showAddModal && (
        <AddRepoModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); fetchRepos(); }}
          existingRepos={repos.map(r => `${r.owner}/${r.repo}`)}
        />
      )}
    </div>
  )
}
