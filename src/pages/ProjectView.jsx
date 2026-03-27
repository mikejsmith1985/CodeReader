import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FileTree from '../components/FileTree'

export default function ProjectView() {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [startFile, setStartFile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/repos/${owner}/${repo}/files`)
      .then(r => r.json())
      .then(data => {
        setFiles(data.files || [])
        setStartFile(data.startFile || null)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [owner, repo])

  const handleFileSelect = (node) => {
    if (node.type === 'file') {
      // path is "owner/repo/filepath" — extract just the filepath
      const filePath = node.path.replace(`${owner}/${repo}/`, '')
      navigate(`/learn?owner=${owner}&repo=${repo}&path=${encodeURIComponent(filePath)}&depth=1`)
    }
  }

  const handleStartHere = () => {
    if (startFile) {
      const filePath = startFile.path.replace(`${owner}/${repo}/`, '')
      navigate(`/learn?owner=${owner}&repo=${repo}&path=${encodeURIComponent(filePath)}&depth=1`)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📂</div>
        <div style={{ color: 'var(--text-secondary)' }}>Loading {owner}/{repo}...</div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Project Header */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: 40 }}>📁</span>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>{repo}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{owner}/{repo}</p>
          </div>
        </div>
      </div>

      {/* Start Here Card */}
      {startFile && (
        <div
          onClick={handleStartHere}
          style={{
            background: 'linear-gradient(135deg, rgba(88,166,255,0.08), rgba(188,140,255,0.08))',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: 20,
            marginBottom: 20,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(88, 166, 255, 0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{
            fontSize: 36,
            background: 'rgba(88,166,255,0.15)',
            borderRadius: 12,
            width: 60,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            🚀
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Start Here
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {startFile.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, opacity: 0.7 }}>
              {startFile.lines} lines · {startFile.language}
            </div>
          </div>
          <div style={{ fontSize: 24, color: 'var(--accent)', flexShrink: 0 }}>→</div>
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, paddingLeft: 4 }}>
        Browse all files:
      </div>

      <FileTree files={files} onSelect={handleFileSelect} />
    </div>
  )
}
