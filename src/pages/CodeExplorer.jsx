import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import CodeBlock from '../components/CodeBlock'
import Explanation from '../components/Explanation'
import DepthSelector from '../components/DepthSelector'
import ChatBox from '../components/ChatBox'
import MiniGoals from '../components/MiniGoals'
import { useAI } from '../hooks/useAI'
import { useProgress } from '../hooks/useProgress'
import { DEPTH_NAMES } from '../utils/xp'

export default function CodeExplorer({ onProgress }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Support new ?owner=&repo=&path= params
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')
  const pathParam = searchParams.get('path')
  const initialDepth = parseInt(searchParams.get('depth')) || 1

  // Virtual file path used as a key everywhere: "owner/repo/filepath"
  const filePath = owner && repo && pathParam ? `${owner}/${repo}/${pathParam}` : null

  const [fileData, setFileData] = useState(null)
  const [depth, setDepth] = useState(initialDepth)
  const [blockIndex, setBlockIndex] = useState(0)
  const [completedDepths, setCompletedDepths] = useState([])
  const [readKeys, setReadKeys] = useState(new Set())
  const [bossUnlocked, setBossUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCode, setShowCode] = useState(false)
  const [explained, setExplained] = useState(false)

  const ai = useAI()
  const progress = useProgress()

  // Load file data
  useEffect(() => {
    if (!owner || !repo || !pathParam) return
    setLoading(true)
    setExplained(false)
    setShowCode(false)
    setBossUnlocked(false)

    fetch(`/api/files?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(pathParam)}`)
      .then(r => r.json())
      .then(data => {
        setFileData(data)
        setBlockIndex(0)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [owner, repo, pathParam])

  // Auto-explain when depth, block, or file changes
  const triggerExplain = useCallback(async () => {
    if (!fileData || loading) return

    setExplained(false)
    setBossUnlocked(false)
    let code
    if (depth <= 2) {
      code = fileData.content
    } else {
      const block = fileData.blocks?.[blockIndex]
      if (!block) return
      code = block.code
    }

    const result = await ai.explain(
      filePath, code, depth,
      depth <= 2 ? -1 : blockIndex,
      `${owner}/${repo}`,
      ''
    )
    if (result) setExplained(true)
  }, [fileData, loading, depth, blockIndex, filePath, owner, repo])

  useEffect(() => {
    triggerExplain()
  }, [triggerExplain])

  const handleGotIt = async () => {
    const bi = depth <= 2 ? -1 : blockIndex
    const key = `${filePath}::${depth}::${bi}`
    if (readKeys.has(key)) return
    const result = await progress.completeExplanation(filePath, depth, bi)
    if (result) onProgress?.(result)
    setReadKeys(prev => new Set([...prev, key]))
    if (!completedDepths.includes(depth)) {
      setCompletedDepths(prev => [...prev, depth])
    }
  }

  const handleQuizMe = () => {
    const code = depth <= 2 ? fileData.content?.slice(0, 2000) : fileData.blocks?.[blockIndex]?.code
    navigate(`/quiz?owner=${owner}&repo=${repo}&path=${encodeURIComponent(pathParam)}&depth=${depth}&block=${blockIndex}&code=${encodeURIComponent(code?.slice(0, 2000) || '')}`)
  }

  const handleGoDeeper = () => {
    if (depth < 4) {
      setDepth(depth + 1)
      setShowCode(false)
    }
  }

  const handleNextBlock = () => {
    if (blockIndex < (fileData?.blocks?.length || 0) - 1) {
      setBlockIndex(blockIndex + 1)
      setShowCode(false)
    }
  }

  const handlePrevBlock = () => {
    if (blockIndex > 0) {
      setBlockIndex(blockIndex - 1)
      setShowCode(false)
    }
  }

  if (!filePath) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Select a file to start learning</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📖</div>
        <div style={{ color: 'var(--text-secondary)' }}>Loading file...</div>
      </div>
    )
  }

  const fileName = pathParam?.split('/').pop() || filePath.split('/').pop()
  const currentBlock = fileData?.blocks?.[blockIndex]
  const totalBlocks = fileData?.blocks?.length || 0
  const depthInfo = DEPTH_NAMES[depth]
  const showBlocks = depth >= 3
  const currentReadKey = `${filePath}::${depth}::${depth <= 2 ? -1 : blockIndex}`
  const alreadyRead = readKeys.has(currentReadKey)

  const isOverviewMode = depth <= 2
  const codePreview = fileData?.content?.split('\n').slice(0, 15).join('\n') || ''

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{fileName}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {fileData?.lines} lines · {fileData?.language}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {owner}/{repo}
        </div>
        <div style={{ fontSize: 13, color: depthInfo?.color || 'var(--text-secondary)', marginTop: 4 }}>
          {depthInfo?.icon} {depthInfo?.name}: {depthInfo?.description}
        </div>
        {showBlocks && totalBlocks > 1 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Block {blockIndex + 1} of {totalBlocks}
          </div>
        )}
      </div>

      {/* Depth Selector */}
      <DepthSelector current={depth} onChange={(d) => { setDepth(d); setShowCode(false) }} completedDepths={completedDepths} />

      {/* === OVERVIEW MODE (Depth 1-2) === */}
      {isOverviewMode && (
        <>
          <Explanation
            text={ai.explanation}
            loading={ai.loading}
            noAI={false}
            depth={depth}
          />

          {ai.explanation && !ai.loading && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn-success"
                onClick={handleGotIt}
                disabled={alreadyRead}
                style={{ fontSize: 15, padding: '12px 24px', opacity: alreadyRead ? 0.5 : 1, cursor: alreadyRead ? 'default' : 'pointer' }}
              >
                {alreadyRead ? '✅ Read!' : '✅ I Read This (+2 XP)'}
              </button>
              <button
                className="btn-primary"
                onClick={handleQuizMe}
                disabled={!bossUnlocked}
                style={{
                  fontSize: 15, padding: '12px 24px',
                  background: bossUnlocked ? '#dc2626' : 'var(--border)',
                  borderColor: bossUnlocked ? '#dc2626' : 'var(--border)',
                  color: bossUnlocked ? '#fff' : 'var(--text-secondary)',
                  cursor: bossUnlocked ? 'pointer' : 'not-allowed',
                  opacity: bossUnlocked ? 1 : 0.7,
                }}
              >
                {bossUnlocked ? '⚔️ Boss Fight!' : '🔒 Boss Fight'}
              </button>
              <button className="btn-secondary" onClick={handleGoDeeper} style={{ fontSize: 15, padding: '12px 24px' }}>
                🔍 Go Deeper
              </button>
            </div>
          )}

          {ai.explanation && !ai.loading && (
            <MiniGoals
              filePath={filePath}
              code={fileData?.content}
              depth={depth}
              filename={fileName}
              lineCount={fileData?.lines || 100}
              onProgress={(result) => onProgress?.(result)}
              onCoverageChange={(met) => setBossUnlocked(met)}
            />
          )}

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button
              onClick={() => setShowCode(!showCode)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--surface)', color: 'var(--text-secondary)',
                fontSize: 13, border: 'none', borderRadius: 0, cursor: 'pointer',
              }}
            >
              <span>👀 {showCode ? 'Hide' : 'Peek at'} the actual code</span>
              <span style={{ fontSize: 11 }}>{showCode ? '▲' : '▼'}</span>
            </button>
            {showCode && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <CodeBlock code={fileData?.content || ''} language={fileData?.language || 'javascript'} startLine={0} />
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', background: 'var(--surface)' }}>
                  ─── End of file · {fileData?.lines} lines total ───
                </div>
              </div>
            )}
            {!showCode && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 0, position: 'relative' }}>
                <CodeBlock code={codePreview} language={fileData?.language || 'javascript'} startLine={0} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, var(--surface))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {(fileData?.lines || 0) > 15 ? `... ${fileData.lines - 15} more lines — click to see all` : `${fileData?.lines} lines total`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* === DETAIL MODE (Depth 3-4) === */}
      {!isOverviewMode && (
        <>
          <CodeBlock code={currentBlock?.code || ''} language={fileData?.language || 'javascript'} startLine={currentBlock?.startLine || 0} />

          <Explanation text={ai.explanation} loading={ai.loading} noAI={false} depth={depth} />

          {ai.explanation && !ai.loading && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn-success"
                onClick={handleGotIt}
                disabled={alreadyRead}
                style={{ fontSize: 15, padding: '12px 24px', opacity: alreadyRead ? 0.5 : 1, cursor: alreadyRead ? 'default' : 'pointer' }}
              >
                {alreadyRead ? '✅ Read!' : '✅ I Read This (+2 XP)'}
              </button>
              <button
                className="btn-primary"
                onClick={handleQuizMe}
                disabled={!bossUnlocked}
                style={{
                  fontSize: 15, padding: '12px 24px',
                  background: bossUnlocked ? '#dc2626' : 'var(--border)',
                  borderColor: bossUnlocked ? '#dc2626' : 'var(--border)',
                  color: bossUnlocked ? '#fff' : 'var(--text-secondary)',
                  cursor: bossUnlocked ? 'pointer' : 'not-allowed',
                  opacity: bossUnlocked ? 1 : 0.7,
                }}
              >
                {bossUnlocked ? '⚔️ Boss Fight!' : '🔒 Boss Fight'}
              </button>
              {depth < 4 && (
                <button className="btn-secondary" onClick={handleGoDeeper} style={{ fontSize: 15, padding: '12px 24px' }}>
                  🔍 Go Deeper
                </button>
              )}
            </div>
          )}

          {ai.explanation && !ai.loading && (
            <MiniGoals
              filePath={filePath}
              code={currentBlock?.code}
              depth={depth}
              filename={fileName}
              lineCount={currentBlock?.code?.split('\n').length || 50}
              onProgress={(result) => onProgress?.(result)}
              onCoverageChange={(met) => setBossUnlocked(met)}
            />
          )}

          {totalBlocks > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <button className="btn-secondary" onClick={handlePrevBlock} disabled={blockIndex === 0} style={{ opacity: blockIndex === 0 ? 0.4 : 1 }}>
                ◀ Previous Block
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(totalBlocks, 30) }, (_, i) => (
                  <div
                    key={i}
                    onClick={() => { setBlockIndex(i); setShowCode(false) }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: i === blockIndex ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                  />
                ))}
                {totalBlocks > 30 && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>+{totalBlocks - 30} more</span>}
              </div>
              <button className="btn-secondary" onClick={handleNextBlock} disabled={blockIndex === totalBlocks - 1} style={{ opacity: blockIndex === totalBlocks - 1 ? 0.4 : 1 }}>
                Next Block ▶
              </button>
            </div>
          )}
        </>
      )}

      <ChatBox
        code={isOverviewMode ? fileData?.content : currentBlock?.code}
        filename={fileName}
        project={`${owner}/${repo}`}
        description=""
      />
    </div>
  )
}
