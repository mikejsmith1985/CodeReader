import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import FileTree from '../components/FileTree'
import { COMPLEXITY_COLORS } from '../utils/xp'

export default function ProjectView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [startFile, setStartFile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch(`/api/projects/${id}/files`).then(r => r.json()),
    ]).then(([projData, fileData]) => {
      const proj = projData.projects?.find(p => p.id === id)
      setProject(proj)
      setFiles(fileData.files || [])
      setStartFile(fileData.startFile || proj?.startFile || null)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [id])

  const handleFileSelect = (node) => {
    if (node.type === 'file') {
      navigate(`/learn?file=${encodeURIComponent(node.path)}&project=${id}&depth=1`)
    }
  }

  const handleStartHere = () => {
    if (startFile) {
      navigate(`/learn?file=${encodeURIComponent(startFile.path)}&project=${id}&depth=1`)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📂</div>
        <div style={{ color: 'var(--text-secondary)' }}>Loading project...</div>
      </div>
    )
  }

  if (!project) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--error)' }}>Project not found</div>
  }

  const complexityColor = COMPLEXITY_COLORS[project.complexity] || 'var(--text-secondary)'

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
          <span style={{ fontSize: 40 }}>{project.icon}</span>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>{project.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{project.description}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--card)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
            {project.language}
          </span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--card)', color: complexityColor, border: '1px solid var(--border)' }}>
            {project.complexity}
          </span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {project.filesCount} files
          </span>
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {(project.linesCount / 1000).toFixed(1)}k lines
          </span>
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
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {startFile.why}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, opacity: 0.7 }}>
              {startFile.lines} lines · {startFile.language}
            </div>
          </div>
          <div style={{ fontSize: 24, color: 'var(--accent)', flexShrink: 0 }}>→</div>
        </div>
      )}

      {/* Browse all files label */}
      <div style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        marginBottom: 8,
        paddingLeft: 4,
      }}>
        Or browse all files:
      </div>

      {/* File Tree */}
      <FileTree files={files} onSelect={handleFileSelect} />
    </div>
  )
}
