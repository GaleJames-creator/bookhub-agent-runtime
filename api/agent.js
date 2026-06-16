import { loadSystemPrompt } from './loader.js'

export const config = { runtime: 'edge' }

/**
 * POST /api/agent
 * Body: { messages: [ { role, content } ] }
 *
 * Forwards conversation history to the Anthropic API with the
 * assembled system prompt. Streams the response back to the client.
 * The API key never reaches the browser.
 */
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { messages } = await req.json()
  const systemPrompt  = await loadSystemPrompt()

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':        process.env.ANTHROPIC_API_KEY,
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
    return new Response(JSON.stringify(err), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Stream the Anthropic SSE response directly back to the widget
  return new Response(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}