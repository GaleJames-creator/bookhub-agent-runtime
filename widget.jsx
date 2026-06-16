import { useState, useRef, useEffect } from 'react'

const PROXY_URL = '/api/agent'

/**
 * BookHub Publisher API agent widget.
 * Renders as a floating button that expands into a chat panel.
 * Calls /api/agent (proxy.js) — API key never touches the client.
 *
 * Inject via mint.json:
 *   "integrations": { "custom": [{ "src": "/widget.js" }] }
 */
export default function Widget() {
  const [open,     setOpen]     = useState(false)
  const [input,    setInput]    = useState('')
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    setLoading(true)

    // Add empty assistant message — will be filled by stream
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const res = await fetch(PROXY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      })

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()

      // Read the SSE stream and append tokens to the last message
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6))
            const token = json?.delta?.text
            if (token) {
              setMessages(m => {
                const updated = [...m]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + token,
                }
                return updated
              })
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch (err) {
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1].content = 'Something went wrong. Please try again.'
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#1D9E75', border: 'none',
          color: '#fff', fontSize: '22px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)', zIndex: 9999,
        }}
        aria-label="Open API assistant"
      >
        {open ? '✕' : '?'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '84px', right: '24px',
          width: '360px', maxHeight: '520px',
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
          display: 'flex', flexDirection: 'column', zIndex: 9998,
          fontFamily: 'system-ui, sans-serif', fontSize: '14px',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #eee',
            fontWeight: '500', color: '#111',
          }}>
            BookHub API assistant
          </div>

          {/* Message list */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {messages.length === 0 && (
              <p style={{ color: '#888', margin: 0 }}>
                Ask me anything about the BookHub Publisher API.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? '#1D9E75' : '#f4f4f4',
                color: msg.role === 'user' ? '#fff' : '#111',
                padding: '8px 12px', borderRadius: '8px',
                maxWidth: '85%', whiteSpace: 'pre-wrap', lineHeight: '1.5',
              }}>
                {msg.content || (loading && i === messages.length - 1
                  ? '▍' : '')}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #eee',
            display: 'flex', gap: '8px',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              disabled={loading}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '6px',
                border: '1px solid #ddd', fontSize: '13px', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 14px', borderRadius: '6px',
                background: '#1D9E75', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: '13px',
              }}
            >Send</button>
          </div>
        </div>
      )}
    </>
  )
}