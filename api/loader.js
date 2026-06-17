const REPO   = 'GaleJames-creator/mintlify-docs'
const BRANCH = 'main'
const BASE   = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/agent`

async function loadSystemPrompt() {
  try {
    const [agent, context, tools] = await Promise.all([
      fetchFile('agent.md'),
      fetchFile('context.md'),
      fetchFile('tools.md'),
    ])

    const result = agent
      .replace('{/* {{context.md}} */}', context)
      .replace('{/* {{tools.md}} */}',   tools)

    console.log('context replaced:', !result.includes('{/* {{context.md}} */}'))
    console.log('tools replaced:', !result.includes('{/* {{tools.md}} */}'))
    console.log('result length:', result.length)
    console.log('agent length:', agent.length)
    console.log('context length:', context.length)
    console.log('tools length:', tools.length)

    if (result.includes('{/* {{')) {
      throw new Error('loader: unresolved placeholder in system prompt')
    }

    return result
  } catch (err) {
    console.error('loadSystemPrompt failed:', err.message)
    throw err
  }
}

async function fetchFile(filename) {
  const url = `${BASE}/${filename}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`loader: failed to fetch ${filename} — ${res.status} ${res.statusText}`)
  }

  return res.text()
}

module.exports = { loadSystemPrompt }
