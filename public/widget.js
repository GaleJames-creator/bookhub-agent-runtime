(function () {
  const PROXY_URL = 'https://bookhub-agent-runtime.vercel.app/api/agent'

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #bh-trigger {
      position: fixed; bottom: 24px; right: 24px;
      width: 48px; height: 48px; border-radius: 50%;
      background: #2563EB; border: none;
      color: #fff; font-size: 22px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    #bh-trigger:hover { background: #1D4ED8; }
    #bh-panel {
      position: fixed; bottom: 84px; right: 24px;
      width: 360px; max-height: 520px;
      background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.13);
      display: none; flex-direction: column; z-index: 9998;
      font-family: system-ui, sans-serif; font-size: 14px;
      border: 1px solid #e5e7eb;
    }
    #bh-panel.open { display: flex; }
    #bh-header {
      padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
      font-weight: 500; color: #111; font-size: 14px;
    }
    #bh-messages {
      flex: 1; overflow-y: auto; padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .bh-msg {
      padding: 8px 12px; border-radius: 8px;
      max-width: 85%; line-height: 1.5; white-space: pre-wrap;
      font-size: 13px;
    }
    .bh-msg.user {
      align-self: flex-end; background: #2563EB; color: #fff;
    }
    .bh-msg.assistant {
      align-self: flex-start; background: #f3f4f6; color: #111;
    }
    #bh-empty {
      color: #9ca3af; font-size: 13px; margin: 0;
    }
    #bh-input-row {
      padding: 10px 12px; border-top: 1px solid #e5e7eb;
      display: flex; gap: 8px;
    }
    #bh-input {
      flex: 1; padding: 8px 10px; border-radius: 6px;
      border: 1px solid #d1d5db; font-size: 13px;
      outline: none; font-family: system-ui, sans-serif;
    }
    #bh-input:focus { border-color: #2563EB; }
    #bh-send {
      padding: 8px 14px; border-radius: 6px;
      background: #2563EB; color: #fff;
      border: none; cursor: pointer; font-size: 13px;
    }
    #bh-send:hover { background: #1D4ED8; }
    #bh-send:disabled { opacity: 0.4; cursor: not-allowed; }
  `
  document.head.appendChild(style)

  // ── HTML ────────────────────────────────────────────────────────────────────
  const trigger = document.createElement('button')
  trigger.id = 'bh-trigger'
  trigger.setAttribute('aria-label', 'Open API assistant')
  trigger.textContent = '?'

  const panel = document.createElement('div')
  panel.id = 'bh-panel'
  panel.innerHTML = `
    <div id="bh-header">BookHub API assistant</div>
    <div id="bh-messages">
      <p id="bh-empty">Ask me anything about the BookHub Publisher API.</p>
    </div>
    <div id="bh-input-row">
      <input id="bh-input" type="text" placeholder="Ask a question…" />
      <button id="bh-send">Send</button>
    </div>
  `

  document.body.appendChild(trigger)
  document.body.appendChild(panel)

  // ── State ───────────────────────────────────────────────────────────────────
  const messages = []
  let loading = false

  const messagesEl = document.getElementById('bh-messages')
  const emptyEl    = document.getElementById('bh-empty')
  const inputEl    = document.getElementById('bh-input')
  const sendEl     = document.getElementById('bh-send')

  // ── Toggle panel ────────────────────────────────────────────────────────────
  trigger.addEventListener('click', () => {
    const open = panel.classList.toggle('open')
    trigger.textContent = open ? '✕' : '?'
    if (open) inputEl.focus()
  })

  // ── Send message ────────────────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim()
    if (!text || loading) return

    loading = true
    sendEl.disabled = true
    inputEl.value = ''

    if (emptyEl) emptyEl.remove()

    // User bubble
    messages.push({ role: 'user', content: text })
    appendBubble('user', text)

    // Empty assistant bubble — filled by stream
    messages.push({ role: 'assistant', content: '' })
    const assistantBubble = appendBubble('assistant', '▍')

    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const json  = JSON.parse(line.slice(6))
            const token = json?.delta?.text
            if (token) {
              assistantText += token
              assistantBubble.textContent = assistantText
              messagesEl.scrollTop = messagesEl.scrollHeight
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

      messages[messages.length - 1].content = assistantText

    } catch {
      assistantBubble.textContent = 'Something went wrong. Please try again.'
      messages[messages.length - 1].content = assistantBubble.textContent
    } finally {
      loading = false
      sendEl.disabled = false
      inputEl.focus()
    }
  }

  function appendBubble(role, text) {
    const div = document.createElement('div')
    div.className = `bh-msg ${role}`
    div.textContent = text
    messagesEl.appendChild(div)
    messagesEl.scrollTop = messagesEl.scrollHeight
    return div
  }

  sendEl.addEventListener('click', send)
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send() })
})()