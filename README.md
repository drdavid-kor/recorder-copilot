# Project Recorder

A single-page speech-to-text (STT) workspace. Upload audio or record from the mic, transcribe via an OpenRouter audio model, then iterate on the transcript with an LLM in a side-by-side chat panel.

## Setup

```bash
npm install
cp config.example.json config.json   # fill in your OpenRouter API key
npm start                            # http://localhost:3000
```

## Configuration

All configuration lives in `config.json` at the project root (gitignored):

- `openrouter.apiKey` — your OpenRouter API key
- `openrouter.apiUrl` — base URL (defaults to `https://openrouter.ai/api/v1`)
- `sttModel` — OpenRouter model id used for transcription
- `models` — list of `{ id, label }` entries shown in the chat model picker

## How it works

- **Left panel** — mic recording, audio file upload (drag-drop), API status
- **Center panel** — markdown workspace, auto-saved to `data/workspace.md`
- **Right panel** — LLM chat with model selector; replies are appended to the workspace below a `---` divider

The Node/Express backend proxies all OpenRouter calls so the API key never reaches the browser. Chat responses stream via SSE.

## Project layout

- `server.js` — Express server, REST routes, static hosting
- `lib/openrouter.js` — OpenRouter transcription + streaming chat client
- `public/index.html` — single-page React UI (React 18 via CDN, no build step)
- `config.example.json` — template for `config.json`
- `docs/prd.md` — product requirements
