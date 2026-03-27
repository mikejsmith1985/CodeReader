import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import powershell from 'highlight.js/lib/languages/powershell'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('go', go)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('powershell', powershell)

export default function CodeBlock({ code, language = 'javascript', startLine = 0 }) {
  const codeRef = useRef(null)

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute('data-highlighted')
      hljs.highlightElement(codeRef.current)
    }
  }, [code, language])

  const lines = code.split('\n')

  return (
    <div style={{
      background: '#0d1117',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      overflow: 'auto',
      fontSize: 13,
      lineHeight: 1.6,
    }}>
      <div style={{ display: 'flex' }}>
        {/* Line numbers */}
        <div style={{
          padding: '12px 0',
          textAlign: 'right',
          userSelect: 'none',
          borderRight: '1px solid var(--border)',
          minWidth: 44,
          flexShrink: 0,
        }}>
          {lines.map((_, i) => (
            <div key={i} style={{
              padding: '0 10px',
              color: 'var(--text-secondary)',
              fontSize: 13,
              opacity: 0.4,
            }}>
              {startLine + i + 1}
            </div>
          ))}
        </div>
        {/* Code */}
        <pre style={{ margin: 0, padding: 12, overflow: 'auto', flex: 1 }}>
          <code ref={codeRef} className={`language-${language === 'html' ? 'xml' : language}`}
            style={{ background: 'transparent', padding: 0 }}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  )
}
