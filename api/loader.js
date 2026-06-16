const REPO  = 'GaleJames-creator/mintlify-docs'
const BRANCH = 'main'
const BASE  = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/agent`

/**
 * Fetches agent.md, context.md, and tools.md from the public
 * mintlify-docs GitHub repo and returns an assembled system prompt.
 *
 * Prerequisites:
 * - mintlify-docs repo must be public
 * - agent/ folder must exist at the repo root
 *
 * agent.md contains {{context.md}} and {{tools.md}} placeholders
 * that are replaced with the actual file contents at runtime.
 */
export async function loadSystemPrompt() {
  const [agent, context, tools] = await Promise.all([
    fetchFile('agent.md'),
    fetchFile('context.md'),
    fetchFile('tools.md'),
  ])

  const result = agent
    .replace('<!-- {{context.md}} -->', context)
    .replace('<!-- {{tools.md}} -->', tools)

  // Guard: catch unresolved placeholders before they reach the model
  if (result.includes('<!-- {{')) {
    throw new Error('loader: unresolved placeholder in system prompt')
  }

  return result
}

async function fetchFile(filename) {
  const url = `${BASE}/${filename}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`loader: failed to fetch ${filename} — ${res.status} ${res.statusText}`)
  }

  return res.text()
}