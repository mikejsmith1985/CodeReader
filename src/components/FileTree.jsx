import { useState } from 'react'

function FileNode({ node, depth = 0, onSelect, selectedPath }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const isSelected = node.path === selectedPath

  if (isDir) {
    return (
      <div>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            paddingLeft: depth * 16 + 8,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-secondary)',
            borderRadius: 4,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 10, width: 12, textAlign: 'center' }}>
            {expanded ? '▼' : '▶'}
          </span>
          <span>📁</span>
          <span>{node.name}</span>
        </div>
        {expanded && node.children?.map((child, i) => (
          <FileNode key={i} node={child} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />
        ))}
      </div>
    )
  }

  const langIcons = {
    javascript: '🟡', typescript: '🔵', python: '🐍', go: '🔷',
    html: '🌐', css: '🎨', json: '📋', markdown: '📝',
    bash: '💲', powershell: '💲', yaml: '⚙️', toml: '⚙️', sql: '🗃️',
  }

  return (
    <div
      onClick={() => onSelect(node)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        paddingLeft: depth * 16 + 8,
        cursor: 'pointer',
        fontSize: 13,
        color: isSelected ? 'var(--accent)' : 'var(--text)',
        background: isSelected ? 'rgba(88,166,255,0.1)' : 'transparent',
        borderRadius: 4,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--card)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 12 }}>{langIcons[node.language] || '📄'}</span>
      <span style={{ flex: 1 }}>{node.name}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{node.lines}L</span>
    </div>
  )
}

export default function FileTree({ files, onSelect, selectedPath }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '8px 0',
      maxHeight: 'calc(100vh - 200px)',
      overflowY: 'auto',
    }}>
      {files?.map((node, i) => (
        <FileNode key={i} node={node} onSelect={onSelect} selectedPath={selectedPath} />
      ))}
    </div>
  )
}
