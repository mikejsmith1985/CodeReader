import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.305 3.492.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const hasError = searchParams.get('error') === 'auth'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>🧠</div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 800,
          background: 'var(--gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 8,
        }}>
          CodeReader
        </h1>

        <p style={{
          fontSize: 18,
          color: 'var(--text-secondary)',
          marginBottom: 48,
          fontWeight: 400,
        }}>
          Duolingo for <em style={{ color: 'var(--accent)', fontStyle: 'normal', fontWeight: 600 }}>YOUR</em> code
        </p>

        {/* Feature bullets */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          marginBottom: 32,
          textAlign: 'left',
        }}>
          {[
            ['🤖', 'AI explains any GitHub repo in plain English'],
            ['🎮', 'Earn XP, unlock achievements, maintain streaks'],
            ['⚔️', 'Boss Fights & Minion Challenges to test your understanding'],
            ['📊', 'Track your progress across all your repos'],
          ].map(([icon, text]) => (
            <div key={text} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {hasError && (
          <div style={{
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid rgba(248,81,73,0.4)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: 'var(--error)',
          }}>
            Authentication failed. Please try again.
          </div>
        )}

        {/* Sign in button */}
        <a
          href="/auth/github"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            padding: '14px 24px',
            background: '#24292f',
            color: '#ffffff',
            borderRadius: 'var(--radius-sm)',
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#2d333b';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#24292f';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <GitHubIcon />
          Sign in with GitHub
        </a>

        <p style={{
          marginTop: 20,
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          We request repo access to browse your private repos.
          <br />
          No code is stored — everything is read in real-time.
        </p>
      </div>
    </div>
  )
}
