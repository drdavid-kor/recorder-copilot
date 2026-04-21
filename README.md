# Project Recorder

A single-page speech-to-text workspace tool. Upload audio files or record via microphone, transcribe using OpenRouter-compatible models, and process transcriptions with an LLM.

## Features

- **File transcription** — Upload mp3/wav/m4a/ogg files, get text back
- **Mic recording** — Record from your microphone, transcribe on stop
- **LLM editor** — Chat with an LLM to process/summarize workspace content; output appends to the workspace
- **Markdown workspace** — Editable workspace with syntax highlighting and auto-save
- **Export** — Download workspace as `.md` file

## Quick Start

### Cloudflare Pages (recommended)

1. Fork/clone this repo and connect it to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Set build output directory to `public`
3. Add environment variables in Cloudflare dashboard:
   - `OPENROUTER_API_KEY` (secret) — your [OpenRouter](https://openrouter.ai/) API key
   - `OPENROUTER_API_URL` — `https://openrouter.ai/api/v1`
   - `STT_MODEL` — model for transcription (e.g. `xiaomi/mimo-v2-omni`)
   - `MODELS` — JSON array of LLM models, e.g. `[{"id":"deepseek/deepseek-v3.2","label":"DeepSeek V3.2"}]`

### Local development

```bash
npm install
cp config.example.json config.json  # fill in your API key
node server.js                      # http://localhost:3000
```

Or with wrangler (matches Cloudflare deployment):

```bash
npm install
npx wrangler pages dev public -b OPENROUTER_API_KEY=your-key-here
```

## Configuration

All config is external — no secrets in code.

**Cloudflare**: environment variables set in the dashboard or `wrangler.toml`.

**Local**: `config.json` at project root (gitignored):

```json
{
  "openrouter": {
    "apiKey": "sk-or-...",
    "apiUrl": "https://openrouter.ai/api/v1"
  },
  "sttModel": "xiaomi/mimo-v2-omni",
  "models": [
    { "id": "deepseek/deepseek-v3.2", "label": "DeepSeek V3.2" }
  ]
}
```

## Architecture

```
public/index.html       Single-page React frontend (CDN, no build step)
functions/api/           Cloudflare Pages Functions (serverless API)
  config.js              GET  /api/config     — model list
  health.js              GET  /api/health     — API key status
  transcribe.js          POST /api/transcribe — audio → text via OpenRouter
  chat.js                POST /api/chat       — LLM chat with SSE streaming
server.js                Local Express server (same API, for local dev)
```

Audio is sent to OpenRouter as base64 via the `input_audio` content type. Mic recordings are converted from webm to WAV in the browser before sending. Workspace auto-saves to localStorage.

## License

MIT
