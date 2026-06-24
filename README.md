# BookHub Agent Runtime

The proxy and loader power the BookHub Publisher API documentation assistant at [galejames.mintlify.app](https://galejames.mintlify.app).

## What's in this repo

- `api/agent.js`&mdash;The Node.js serverless function on Vercel receives `POST` requests from the chat widget, attaches the Anthropic API key, and forwards the request to the Anthropic Messages API. It streams the response back to the browser. Vercel stores the API key as an environment variable and uses it only on the server during request forwarding. It is never sent to the browser.
- `api/loader.js`&mdash;Fetches the three agent definition files (Markdown) from the `mintlify-docs` repo and concatenates them into a single system prompt on every Anthropic API request, so changes take effect immediately after pushing updates to the `main` branch&mdash;no redeployment required. The model reads the full agent definition before processing each user message. Both functions run only on Vercel&mdash;the `.env` file is for local development reference only, and the deployed function does not use it.

## How the agent works

The agent is a large language model (Claude) that answers questions about the BookHub Publisher API. Its behavior is controlled by three Markdown files in the mintlify-docs repo:

- `agent/agent.md`&mdash;defines the agent’s persona, scope, tone, response
format, and behavior rules
- `agent/context.md`&mdash;provides [grounding content](#how-grounding-content-shapes-responses), covering authentication, rate limits, error codes, pagination, changelog, and breaking changes.
- `agent/tools.md`&mdash;describes tools the agent can invoke: searching the docs, fetching a page, looking up an endpoint, and opening a support ticket

At runtime, `loader.js` fetches all three files from GitHub raw URLs and concatenates them into a single `system` parameter string. `agent.js` passes this string as the `system` parameter in the Anthropic API request, so the model reads the full agent definition files before processing each user message.

The chat widget (`widget.js`) lives in mintlify-docs and is served by Mintlify on every page. It sends conversation history to `api/agent` on each turn and renders streaming responses as formatted Markdown using marked.js.

## How grounding content shapes responses

At runtime, `loader.js` fetches all three files and concatenates them into a single system prompt. Claude reads this system prompt before processing each user message, so every response is grounded in the current state of those files, not general training data. See [How the agent works](#how-the-agent-works) for details on the agent's behavior.

This is the conversation retrieval flow:

1. The user submits a query in the chat widget.
2. `loader.js` fetches the three agent definition files from GitHub and concatenates them into the system prompt.
3. `agent.js` sends an API request to Claude with the assembled system prompt and the full conversation history.
4. Claude generates a response grounded in the system prompt content.
5. The response streams back to the user via Server-Sent Events.

Because the agent definition files are fetched fresh on every request, updating agent behavior requires no redeployment&mdash;push changes to the Markdown files in `mintlify-docs/agent/` and they take effect on the next request.

### Why content structure affects response quality

The system prompt is assembled by concatenating three files in a fixed order: `agent.md`, `context.md`, `tools.md`. Claude reads this content sequentially before generating a response. Clear headings, focused scope per file, and precise factual content in `context.md` produce more accurate responses than mixed or loosely structured content.

If `context.md` contains contradictory facts, overlapping coverage, or content that belongs in the `agent.md`, response accuracy degrades. The same principle applies to `tools.md`&mdash;tool descriptions that are ambiguous or overlap in scope produce unpredictable tool selection behavior.

Treat the agent definition files with the same discipline as any API reference: one concept per section, accurate facts, no redundancy.

## API contract

### Request

`POST /api/agent`

**Header**

| Header         | Value              |
|----------------|--------------------|
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
- A clone of [mintlify-docs](https://github.com/GaleJames-creator/mintlify-docs). The repo must be public so `loader.js` can fetch the agent definition files.

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

This file is excluded from Git by the `.gitignore` file. It is not used by the deployed function&mdash;Vercel uses its own environment variable store.

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** and import this repo.
3. Leave all build settings at their defaults&mdash;Vercel automatically detects the `api/` folder.
4. Click **Deploy**.

### 4. Add the API key to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add `ANTHROPIC_API_KEY` with your key as the value.
3. Paste the key as a single unbroken string&mdash;line breaks will cause an invalid header error.
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

**API key rotation**&mdash;If you rotate your Anthropic API key, update the environment variable in Vercel and redeploy. Revoke the old key immediately after the new one is confirmed to work.

**Anthropic API rate limits**&mdash;Rate limits depend on your Anthropic usage tier. If the agent returns a `529 Overloaded` error, the upstream Anthropic API is rate-limiting your key. Check your tier at [console.anthropic.com](https://console.anthropic.com).

**Cold starts**&mdash;Vercel serverless functions may experience a 1–3 second delay on the first request after a period of inactivity.

## Updating agent behavior

Edit the Markdown files in `mintlify-docs/agent/`&mdash;no changes to this repo are required. Changes take effect on the next request after the updated files are pushed to the `main` branch of `mintlify-docs`.

## Glossary

**Agent definition files**&mdash;The three Markdown files (`agent.md`, `context.md`, and `tools.md`) in `mintlify-docs/agent/` that define the agent's behavior, grounding content, and tools. See [How grounding content shapes responses](#how-grounding-content-shapes-responses).

**Grounding content**&mdash;The runtime role of the agent definition files&mdash;facts loaded into the model before it responds, so answers draw from your documentation rather than general training data.

**Server-Sent Events (SSE)**&mdash;A streaming protocol used to send the model's response token by token as it is generated, rather than waiting for the full response before returning it to the browser.

**System prompt**&mdash;The instructions passed to the model before the conversation begins. In this project, the system prompt is assembled by `loader.js` from the three agent definition files and passed as a `system` parameter in the Anthropic API request.

## Related

- [mintlify-docs](https://github.com/GaleJames-creator/mintlify-docs)&mdash;it contains the `agent/` folder with the Markdown files that define agent behavior, and `widget.js`, which renders the chat widget on every page.
- [BookHub Publisher API docs](https://galejames.mintlify.app)
- [Portfolio](https://github.com/GaleJames-creator/gale-james)
