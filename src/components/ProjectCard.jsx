import { Link } from 'react-router-dom'
import ProgressRing from './ProgressRing'
import { COMPLEXITY_COLORS } from '../utils/xp'

export default function ProjectCard({ project, completionPercent = 0 }) {
  const complexityColor = COMPLEXITY_COLORS[project.complexity] || 'var(--text-secondary)'

  return (
    <Link to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
      <div className="fade-in" style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s',
        cursor: 'pointer',
        height: '100%',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(88, 166, 255, 0.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 32 }}>{project.icon}</span>
          <ProgressRing percent={completionPercent} size={48} stroke={4} />
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {project.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {project.description}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
          }}>
            {project.language}
          </span>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'var(--surface)',
            color: complexityColor,
            border: '1px solid var(--border)',
          }}>
            {project.complexity}
          </span>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}>
            {project.filesCount} files · {(project.linesCount / 1000).toFixed(1)}k lines
          </span>
        </div>
      </div>
    </Link>
  )
}
