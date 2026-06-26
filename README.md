# Project Recorder

A single-page speech-to-text (STT) workspace. Upload audio or record from the mic, transcribe via an OpenRouter audio model, then iterate on the transcript with an LLM in a side-by-side chat panel.

The app supports BYOK (bring your own key): users can paste an OpenRouter API key in the frontend Settings dialog. The key is stored only in that browser's `localStorage` and sent with transcription/chat API calls; the backend does not persist it.

## Setup

### Local Node server

```bash
npm install
cp config.example.json config.json   # fill in your OpenRouter API key
npm start                            # http://localhost:3000
```

### Cloudflare Pages

```bash
npm install
cp .dev.vars.example .dev.vars       # fill in OPENROUTER_API_KEY
npm run cf:dev                       # http://localhost:8788
```

For production Cloudflare Pages, bind a KV namespace named `RECORDER_KV` and set `OPENROUTER_API_KEY` as a secret. See `docs/deployment/cloudflare.md`.

Cloudflare build settings:

- Build command: `npm run build`
- Deploy command: `npm run deploy` or `npx wrangler pages deploy public`
- Build output directory: `public`

Do not use `npx wrangler deploy` for this Pages app; that command targets Workers and will fail without a Worker entrypoint.

## Configuration

For the local Node server, configuration lives in `config.json` at the project root (gitignored):

- `openrouter.apiKey` — your OpenRouter API key
- `openrouter.apiUrl` — base URL (defaults to `https://openrouter.ai/api/v1`)
- `sttModel` — OpenRouter model id used for transcription
- `models` — list of `{ id, label }` entries shown in the chat model picker

For Cloudflare, equivalent values are environment variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_API_URL`
- `STT_MODEL`
- `MODELS_JSON`
- `RECORDER_KV` — KV binding for `workspace.md` persistence

If no server-side OpenRouter key is configured, users can still use the app by opening **Settings** and saving their own OpenRouter key locally.

## How it works

- **Left panel** — mic recording, audio file upload (drag-drop), API status
- **Center panel** — markdown workspace, auto-saved to `data/workspace.md`
- **Right panel** — LLM chat with model selector; replies are appended to the workspace below a `---` divider
- **Settings** — optional BYOK OpenRouter API key saved in browser local storage

The backend proxies all OpenRouter calls so the API key never reaches the browser. In local mode that backend is Node/Express; in Cloudflare mode it is Pages Functions. Chat responses stream via SSE in both modes.

## Project layout

- `server.js` — Express server, REST routes, static hosting
- `lib/openrouter.js` — OpenRouter transcription + streaming chat client
- `functions/` — Cloudflare Pages Functions implementation of the same `/api/*` routes
- `public/index.html` — single-page React UI (React 18 via CDN, no build step)
- `config.example.json` — template for `config.json`
- `wrangler.toml` — Cloudflare Pages/Functions configuration
- `.dev.vars.example` — local Cloudflare secrets template
- `docs/deployment/cloudflare.md` — Cloudflare setup guide
- `docs/prd.md` — product requirements
