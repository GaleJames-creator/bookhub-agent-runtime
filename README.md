# BookHub Agent Runtime

The proxy and loader power the BookHub Publisher API documentation assistant at [galejames.mintlify.app](https://galejames.mintlify.app).

## What's in this repo

- `api/agent.js`&mdash;The Node.js serverless function, deployed on Vercel, receives `POST` requests from the chat widget, attaches the Anthropic API key, and forwards the request to the Anthropic Messages API. Streams the response back to the browser. The API key is stored as a Vercel environment variable and is only used server-side during request forwarding — it is never sent to the browser.
- `api/loader.js`&mdash;Fetches the three agent definition files (Markdown) from the `mintlify-docs` repo and concatenates them into a single system prompt, passed to the Anthropic API as the `system` parameter, so the model reads the full agent definition before processing each user message. Both functions run only on Vercel — the `.env` file is for local development reference only and is not used by the deployed function.

## How the agent works

The agent is a large language model (Claude) that answers questions about the BookHub Publisher API. Its behavior is controlled by three Markdown files in the mintlify-docs repo:

- `agent/agent.md`&mdash;defines the agent’s persona, scope, tone, response
format, and behavior rules
- `agent/context.md`&mdash;provides grounding content (facts loaded into the model before it responds, so answers draw from your documentation rather than general training data), covering authentication, rate limits, error codes, pagination, changelog, and breaking changes.
- `agent/tools.md`&mdash;describes tools the agent can invoke: searching the docs, fetching a page, looking up an endpoint, and opening a support ticket

At runtime, `loader.js` fetches all three files from GitHub raw URLs and concatenates them into a single `system` parameter string. `agent.js` passes this string as the `system` parameter in the Anthropic API request, meaning the model reads the full agent definition files (Markdown) before processing each user message.

The chat widget (`widget.js`) lives in mintlify-docs and is served by Mintlify on every page. It sends conversation history to `api/agent` on each turn and renders streaming responses as formatted Markdown using marked.js.

## API contract

### Request

`POST /api/agent`

**Header**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Body**

```json
{
  "messages": [
    { "role": "user", "content": "How do I authenticate?" },
    { "role": "assistant", "content": "Use a Bearer token..." },
    { "role": "user", "content": "Where do I get the token?" }
  ]
}
```

The `messages` array contains the full conversation history. Each object requires a `role` (`user` or `assistant`) and `content` (string).

### Response

Successful responses stream as Server-Sent Events (`text/event-stream`). Each event contains a JSON delta:

```json
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Use"}}
```

The stream ends with a `message_stop` event:

```json
event: message_stop
data: {"type":"message_stop"}
```

If the Anthropic API returns an error mid-stream, an `error` event is sent before `message_stop`. The client should treat any `error` event as a failed response.

The client should stop reading the stream upon receiving this event.

### Error codes

| Status | Cause                                                          |
|--------|----------------------------------------------------------------|
| `405`  | Request method is not POST                                     |
| `500`  | Function invocation failed&mdash;check Vercel logs for details |

## Prerequisites

- A Vercel account connected to GitHub.
- An Anthropic API key&mdash;obtain one at [console.anthropic.com](https://console.anthropic.com) under API Keys → Create Key.
- A clone of [mintlify-docs](https://github.com/GaleJames-creator/mintlify-docs). The repo must be public so `loader.js` can fetch the agent definition files (Markdown).

## Setup

### 1. Clone this repo

```bash
git clone https://github.com/GaleJames-creator/bookhub-agent-runtime.git
```

### 2. Create a local `.env` file

Create `.env` at the repo root for local reference:

```bash
ANTHROPIC_API_KEY=your-key-here
```

This file is excluded from Git by the `.gitignore` file. It is not used by the deployed function — Vercel uses its own environment variable store.

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** and import this repo.
3. Leave all build settings at their defaults&mdash;Vercel automatically detects the `api/` folder.
4. Click **Deploy**.

### 4. Add the API key to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add `ANTHROPIC_API_KEY` with your key as the value.
3. Paste the key as a single unbroken string — line breaks will cause an invalid header error.
4. Click **Save**, then **Redeploy** to apply the change.

### 5. Confirm the function is live

Send a GET request to the function URL:

```bash
curl https://your-vercel-project.vercel.app/api/agent
```

A `405 Method Not Allowed` response is the only expected success response&mdash;the endpoint does not serve GET requests. Any other status code indicates a deployment issue.

### 6. Update the widget

In `mintlify-docs`, update `widget.js` to point to your Vercel function URL:

```javascript
const PROXY_URL = 'https://your-vercel-project.vercel.app/api/agent'
```

## Deployment notes

**GitHub fetch failures**&mdash;`loader.js` does not implement retry logic or timeout handling for GitHub raw URL requests. If a fetch fails, the function returns a 500 error. Ensure `mintlify-docs` is public before deploying.

**Vercel function timeout**&mdash;The Hobby plan has a 10-second function timeout. Streaming begins as soon as the Anthropic API returns the first token, so responses typically start within 1–2 seconds. Full responses to complex questions may exceed the Hobby plan's timeout.

**API key rotation**&mdash;If you rotate your Anthropic API key, update the environment variable in Vercel and redeploy. The old key should be revoked immediately after the new one is confirmed to work.

**Anthropic API rate limits**&mdash;Rate limits depend on your Anthropic usage tier. If the agent returns a `529 Overloaded` error, the upstream Anthropic API is rate-limiting your key. Check your tier at [console.anthropic.com](https://console.anthropic.com).

**Cold starts**&mdash;Vercel serverless functions may experience a 1–3 second delay on the first request after a period of inactivity.

## Updating agent behavior

Edit the Markdown files in `mintlify-docs/agent/`&mdash;no changes to this repo are required. Changes take effect on the next request after the updated files are pushed to the `main` branch of `mintlify-docs`.

## Glossary

**Grounding content**&mdash;Specific facts are loaded into the model's context before it responds. Grounding ensures the agent answers from your documentation rather than its general training data.

**System prompt**&mdash;The instructions passed to the model before the conversation begins. In this project, the system prompt is assembled by `loader.js` from the three agent definition files and passed as a `system` parameter in the Anthropic API request.

**Agent definition files**&mdash;The three Markdown files in `mintlify-docs/agent/` (`agent.md`, `context.md`, `tools.md`) that define the agent's behavior, grounding content, and tools.

**Server-Sent Events (SSE)**&mdash;A streaming protocol used to send the model's response token by token as it is generated, rather than waiting for the full response before returning it to the browser.

## Related

- [mintlify-docs](https://github.com/GaleJames-creator/mintlify-docs)&mdash;it contains the `agent/` folder with the Markdown files that define agent behavior, and `widget.js`, which renders the chat widget on every page.
- [BookHub Publisher API docs](https://galejames.mintlify.app)
- [Portfolio](https://github.com/GaleJames-creator/gale-james)
