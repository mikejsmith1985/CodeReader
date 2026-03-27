import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  { id: 'welcome', title: 'Welcome', icon: '👋' },
  { id: 'create', title: 'Create Token', icon: '🔑' },
  { id: 'permissions', title: 'Set Permissions', icon: '🛡️' },
  { id: 'copy', title: 'Copy Token', icon: '📋' },
  { id: 'paste', title: 'Paste Here', icon: '✏️' },
  { id: 'test', title: 'Test It', icon: '🧪' },
]

export default function SetupWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [currentStatus, setCurrentStatus] = useState(null)

  useEffect(() => {
    fetch('/api/ai-status').then(r => r.json()).then(setCurrentStatus).catch(() => {})
  }, [])

  const handleTest = async () => {
    if (!token.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/setup-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), action: 'test' }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (e) {
      setTestResult({ success: false, message: 'Network error: ' + e.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/setup-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), action: 'save' }),
      })
      const data = await res.json()
      if (data.success) {
        // Navigate immediately — before Vite's file-watcher detects .env change and reloads the page
        navigate('/?ai=ready')
      } else {
        setSaveError(data.message || 'Failed to save')
      }
    } catch (e) {
      setSaveError('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  // Already working?
  if (currentStatus?.status === 'working') {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>AI is already set up!</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Your GitHub token is working and AI explanations are active.
        </p>
        <button className="btn-primary" onClick={() => navigate('/')} style={{ fontSize: 15, padding: '12px 32px' }}>
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  // Completed state
  if (step === STEPS.length) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20, animation: 'pulse 2s infinite' }}>🎉</div>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>You're all set!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>
          AI-powered explanations are now active. Every file you explore will get
          rich, conversational explanations from GPT-4o-mini — completely free.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 28 }}>
          Note: The server needs to restart to pick up the new token.
          Press Ctrl+C in your terminal and run <code style={codeStyle}>npm start</code> again.
        </p>
        <button className="btn-success" onClick={() => navigate('/')} style={{ fontSize: 16, padding: '14px 40px' }}>
          🚀 Start Learning!
        </button>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ maxWidth: 650, margin: '20px auto' }}>
      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              height: 4,
              width: '100%',
              borderRadius: 2,
              background: i <= step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
            <span style={{
              fontSize: 11,
              color: i <= step ? 'var(--accent)' : 'var(--text-secondary)',
              opacity: i === step ? 1 : 0.6,
            }}>
              {s.icon}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 32,
        minHeight: 300,
      }}>
        {step === 0 && <StepWelcome />}
        {step === 1 && <StepCreate />}
        {step === 2 && <StepPermissions />}
        {step === 3 && <StepCopy />}
        {step === 4 && (
          <StepPaste
            token={token}
            setToken={setToken}
          />
        )}
        {step === 5 && (
          <StepTest
            token={token}
            testing={testing}
            testResult={testResult}
            saving={saving}
            saveError={saveError}
            onTest={handleTest}
            onSave={handleSave}
          />
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button
          className="btn-secondary"
          onClick={step === 0 ? () => navigate('/') : prev}
          style={{ padding: '10px 24px' }}
        >
          {step === 0 ? '← Skip for now' : '← Back'}
        </button>

        {step < 4 && (
          <button className="btn-primary" onClick={next} style={{ padding: '10px 24px' }}>
            Next →
          </button>
        )}
        {step === 4 && (
          <button
            className="btn-primary"
            onClick={next}
            disabled={!token.trim()}
            style={{ padding: '10px 24px', opacity: token.trim() ? 1 : 0.4 }}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}

const codeStyle = {
  background: 'var(--card)',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'monospace',
  border: '1px solid var(--border)',
}

const imgStyle = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  maxWidth: '100%',
  margin: '12px 0',
}

function StepWelcome() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>Let's set up AI explanations</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.8, maxWidth: 480, margin: '0 auto' }}>
        CodeReader can use <strong style={{ color: 'var(--text)' }}>GitHub's free AI models</strong> to
        explain your code in plain English — like having a patient tutor read every file for you.
      </p>
      <div style={{
        marginTop: 24,
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <InfoChip icon="💰" label="100% Free" />
        <InfoChip icon="⏱️" label="~2 minutes" />
        <InfoChip icon="🔒" label="Your token stays local" />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 20, opacity: 0.7 }}>
        You'll need a GitHub account (which you already have!).
      </p>
    </div>
  )
}

function StepCreate() {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Step 1: Open GitHub Token Settings</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
        Click the button below to open GitHub's token page in a new tab:
      </p>

      <a
        href="https://github.com/settings/tokens?type=beta"
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 24px',
          background: '#238636',
          color: 'white',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.target.style.background = '#2ea043'}
        onMouseLeave={e => e.target.style.background = '#238636'}
      >
        🔗 Open GitHub Token Settings
      </a>

      <div style={{ marginTop: 24, background: 'var(--card)', borderRadius: 8, padding: 16 }}>
        <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          📋 On that page:
        </p>
        <ol style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2.2, paddingLeft: 20 }}>
          <li>Click the green <strong style={{ color: 'var(--success)' }}>"Generate new token"</strong> button</li>
          <li>Give it a name like <code style={codeStyle}>CodeReader</code></li>
          <li>Set expiration to <strong style={{ color: 'var(--text)' }}>90 days</strong> (or your preference)</li>
          <li>Leave "Repository access" as <strong style={{ color: 'var(--text)' }}>"Public Repositories (read-only)"</strong></li>
        </ol>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 16, opacity: 0.7 }}>
        Don't click "Generate token" yet — we need to set permissions first!
      </p>
    </>
  )
}

function StepPermissions() {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Step 2: Enable the Models Permission</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        This is the key step — we need to give the token permission to use AI models.
      </p>

      <div style={{ background: 'var(--card)', borderRadius: 8, padding: 20 }}>
        <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          📋 On the token creation page:
        </p>
        <ol style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2.4, paddingLeft: 20 }}>
          <li>
            Scroll down to the <strong style={{ color: 'var(--text)' }}>"Permissions"</strong> section
          </li>
          <li>
            Expand <strong style={{ color: 'var(--text)' }}>"Account permissions"</strong> (click the arrow)
          </li>
          <li>
            Find <strong style={{ color: 'var(--accent)' }}>"Models"</strong> in the list
          </li>
          <li>
            Change it from "No access" to <strong style={{ color: 'var(--success)' }}>"Read-only"</strong>
          </li>
        </ol>
      </div>

      <div style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 8,
        background: 'rgba(88,166,255,0.08)',
        border: '1px solid rgba(88,166,255,0.2)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--accent)' }}>💡 Why "Models"?</strong><br />
        This permission lets your token access GitHub's free AI models (like GPT-4o-mini).
        It can only <em>read</em> — it can't change anything on your account.
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(210,153,34,0.08)',
        border: '1px solid rgba(210,153,34,0.2)',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}>
        ⚠️ If you don't see "Models" in the permissions list, you may need to
        join the <a href="https://github.com/marketplace/models" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
        GitHub Models marketplace</a> first (it's free — just click "Get started").
      </div>
    </>
  )
}

function StepCopy() {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Step 3: Generate & Copy Your Token</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        Now let's create the token and copy it.
      </p>

      <div style={{ background: 'var(--card)', borderRadius: 8, padding: 20 }}>
        <ol style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 2.4, paddingLeft: 20 }}>
          <li>
            Scroll to the bottom and click the green{' '}
            <strong style={{ color: 'var(--success)' }}>"Generate token"</strong> button
          </li>
          <li>
            You'll see your new token — it starts with{' '}
            <code style={codeStyle}>github_pat_</code> or <code style={codeStyle}>ghp_</code>
          </li>
          <li>
            Click the <strong style={{ color: 'var(--text)' }}>📋 copy button</strong> next to it
          </li>
        </ol>
      </div>

      <div style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 8,
        background: 'rgba(248,81,73,0.08)',
        border: '1px solid rgba(248,81,73,0.2)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--error)' }}>⚠️ Important:</strong> GitHub only shows the token{' '}
        <strong>once</strong>. Make sure you copy it before leaving that page!
        If you lose it, you'll need to create a new one (no big deal, just takes a minute).
      </div>
    </>
  )
}

function StepPaste({ token, setToken }) {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Step 4: Paste Your Token</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        Paste the token you just copied from GitHub:
      </p>

      <div style={{ position: 'relative' }}>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="github_pat_xxxxxxxxxxxx..."
          autoFocus
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 15,
            fontFamily: 'monospace',
            background: 'var(--card)',
            border: `2px solid ${token ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8,
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
        {token && (
          <div style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 18,
          }}>
            ✅
          </div>
        )}
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(63,185,80,0.08)',
        border: '1px solid rgba(63,185,80,0.2)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        🔒 <strong style={{ color: 'var(--success)' }}>Your token stays on your computer.</strong>{' '}
        It's saved to a local <code style={codeStyle}>.env</code> file and only sent to GitHub's
        AI service — nowhere else.
      </div>
    </>
  )
}

function StepTest({ token, testing, testResult, saving, saveError, onTest, onSave }) {
  return (
    <>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Step 5: Let's Test It!</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
        Click the button below to verify your token works with GitHub's AI:
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          className="btn-primary"
          onClick={onTest}
          disabled={testing || !token}
          style={{ padding: '12px 28px', fontSize: 15, opacity: testing ? 0.6 : 1 }}
        >
          {testing ? '🔄 Testing...' : '🧪 Test Connection'}
        </button>
      </div>

      {testResult && (
        <div style={{
          padding: 20,
          borderRadius: 8,
          background: testResult.success
            ? 'rgba(63,185,80,0.08)'
            : 'rgba(248,81,73,0.08)',
          border: `1px solid ${testResult.success
            ? 'rgba(63,185,80,0.3)'
            : 'rgba(248,81,73,0.3)'}`,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>
            {testResult.success ? '🎉' : '😕'}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 600, textAlign: 'center', marginBottom: 4,
            color: testResult.success ? 'var(--success)' : 'var(--error)',
          }}>
            {testResult.success ? 'It works!' : 'Something went wrong'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
            {testResult.message}
          </div>

          {testResult.success && testResult.sample && (
            <div style={{
              marginTop: 16, padding: 12, background: 'var(--card)',
              borderRadius: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.7,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                🤖 Here's a sample AI explanation:
              </div>
              {testResult.sample}
            </div>
          )}

          {testResult.success && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                className="btn-success"
                onClick={onSave}
                disabled={saving}
                style={{ padding: '12px 32px', fontSize: 15 }}
              >
                {saving ? '💾 Saving...' : '💾 Save Token & Finish'}
              </button>
              {saveError && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 8,
                  background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)',
                  fontSize: 13, color: 'var(--error)', textAlign: 'left',
                }}>
                  ⚠️ {saveError}
                </div>
              )}
            </div>
          )}

          {!testResult.success && (
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong>Common fixes:</strong>
              <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                <li>Make sure you selected <strong>"Models → Read-only"</strong> in permissions</li>
                <li>Try visiting <a href="https://github.com/marketplace/models" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>GitHub Models marketplace</a> first</li>
                <li>Ensure the token hasn't expired</li>
                <li>Try creating a new token from scratch</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function InfoChip({ icon, label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 20,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      fontSize: 13,
      color: 'var(--text-secondary)',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}
