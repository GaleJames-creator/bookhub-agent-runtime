# BookHub Agent Runtime

The proxy and chat widget that power the BookHub Publisher API documentation assistant.

## What's in this repo

- `agent/` — Markdown files that define the agent's behavior
- `agent-runtime/loader.js` — assembles the system prompt at runtime
- `agent-runtime/proxy.js` — Vercel Edge Function; forwards requests
  to the Anthropic API without exposing the API key to the client
- `agent-runtime/widget.jsx` — floating chat widget injected into the Mintlify docs site

## Related

- [BookHub Publisher API docs](https://galejames.mintlify.app)
- [Portfolio](https://github.com/GaleJames-creator/gale-james)

## Setup

1. Clone this repo
2. Add `.env` with `ANTHROPIC_API_KEY=your-key`
3. Deploy to Vercel
4. Add `ANTHROPIC_API_KEY` to Vercel environment variables
5. Update `integrations.custom.src` in your Mintlify `docs.json`
   with your Vercel deployment URL
