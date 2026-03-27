import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import ProjectCard from '../components/ProjectCard'
import XPBar from '../components/XPBar'
import StreakCounter from '../components/StreakCounter'

export default function Dashboard({ progress }) {
  const [projects, setProjects] = useState([])
  const [challenge, setChallenge] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiJustConfigured, setAiJustConfigured] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we just came back from the setup wizard
    if (searchParams.get('ai') === 'ready') {
      setAiJustConfigured(true)
      navigate('/', { replace: true }) // clean the URL
    }

    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/daily-challenge').then(r => r.json()),
      fetch('/api/ai-status').then(r => r.json()),
    ]).then(([projData, challengeData, aiData]) => {
      setProjects(projData.projects || [])
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
        <div style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Scanning your projects...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header section */}
      <div style={{
        display: 'flex',
        gap: 20,
        marginBottom: 32,
        flexWrap: 'wrap',
      }}>
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
            to={`/learn?file=${encodeURIComponent(challenge.filePath)}&project=${challenge.projectId}&depth=1`}
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

      {/* AI Just Configured Success Banner */}
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
              Every file you explore will now get conversational AI explanations. Pick a project below to start!
            </div>
          </div>
        </div>
      )}

      {/* AI Status Banner (only show if not just configured) */}
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
                {aiStatus.status === 'not_configured'
                  ? 'Unlock AI-powered explanations (free!)'
                  : 'Fix AI token setup'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {aiStatus.status === 'not_configured'
                  ? 'Takes ~2 minutes. Get a free GitHub token and let AI explain your code in plain English.'
                  : 'Your token needs updating. Click to run the setup wizard.'}
              </div>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
              Set up →
            </span>
          </div>
        </Link>
      )}

      {/* Projects Grid */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Your Projects</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {projects.length} projects · Ordered from simplest → most complex
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} completionPercent={0} />
        ))}
      </div>
    </div>
  )
}
