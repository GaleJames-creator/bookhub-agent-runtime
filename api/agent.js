import { loadSystemPrompt } from './loader.js'

export default async function handler(req, res) {
  const origin = req.headers.origin ?? '*'

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders)
    res.end('Method not allowed')
    return
  }

  const { messages } = req.body
  const systemPrompt  = await loadSystemPrompt()

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      stream:     true,
      messages,
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.json()
    res.writeHead(upstream.status, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(err))
    return
  }

  res.writeHead(200, {
    ...corsHeaders,
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'X-Accel-Buffering': 'no',
  })

  const reader  = upstream.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(decoder.decode(value, { stream: true }))
  }

  res.end()
}
