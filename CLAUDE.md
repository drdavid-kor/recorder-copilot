# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Recorder** is a single-page speech-to-text (STT) workspace tool. Users upload audio files or record via microphone, transcribe with an audio-capable LLM through OpenRouter, and iterate on the transcript with an LLM chat panel.

The app deploys to **Cloudflare Pages + Pages Functions**. There is no separate Node server — the backend is the set of `/api/*` Functions in `functions/`.

## Setup & Run

```bash
npm install
cp .dev.vars.example .dev.vars      # fill in OPENROUTER_API_KEY
npm run dev                         # http://localhost:8788 (wrangler pages dev)
```

Deploy:

```bash
npm run kv:create                   # one-time: create the RECORDER_KV namespace
# uncomment [[kv_namespaces]] in wrangler.toml and paste the id (or bind it in the dashboard)
npm run deploy                      # wrangler pages deploy (config-driven)
```

## Project Structure

- `public/index.html` — Single-page React frontend (React 18 via CDN, no build step)
- `functions/api/*.js` — Pages Functions: one file per `/api/*` route
- `functions/_shared/*.js` — Shared helpers (config, http responses, OpenRouter client)
- `wrangler.toml` — Pages/Functions config: output dir, `[vars]`, and the (commented) KV binding
- `.dev.vars.example` — Template for local Cloudflare secrets (`.dev.vars`, gitignored)
- `docs/deployment/cloudflare.md` — Cloudflare setup guide
- `docs/prd.md` — Product Requirements Document
- `docs/specs/technical-spec.md` — Technical spec

## Architecture

**Frontend:** Single-page React app served as a static asset by Pages. Three-column layout:
- **Left panel**: Mic recording, audio upload (drag-drop), device selector, API status, BYOK settings
- **Center panel**: Markdown workspace (textarea + synced highlight), auto-saved to KV
- **Right panel**: LLM chat with model selector

**Backend (Pages Functions):** Each `/api/*` route is a Function that:
- Proxies OpenRouter calls so the server-side API key is never exposed to the browser
- Supports BYOK — a per-request `X-OpenRouter-Api-Key` header overrides the server key
- Persists the workspace markdown in Cloudflare KV (`RECORDER_KV`)
- Reads configuration from environment variables / `wrangler.toml` `[vars]`

**Data flow:** Audio → `/api/transcribe` → OpenRouter (audio model) → transcription text → workspace. User prompt → `/api/chat` → OpenRouter (SSE streaming) → chat panel → appended to workspace.

## API Routes

| Route | File | Backed by |
| --- | --- | --- |
| `GET /api/config` | `functions/api/config.js` | env vars |
| `GET /api/health` | `functions/api/health.js` | OpenRouter `/key`, KV check |
| `GET/POST /api/workspace` | `functions/api/workspace.js` | KV `workspace.md` |
| `POST /api/transcribe` | `functions/api/transcribe.js` | OpenRouter `chat/completions` |
| `POST /api/chat` | `functions/api/chat.js` | OpenRouter streaming `chat/completions` |

## Configuration

Configured through Cloudflare environment, not a config file:

- `OPENROUTER_API_KEY` — server-funded key (secret). Optional for BYOK-only deployments.
- `OPENROUTER_API_URL` — defaults to `https://openrouter.ai/api/v1`
- `STT_MODEL` — audio-capable OpenRouter model used for transcription
- `MODELS_JSON` — JSON array of `{ id, label }` chat-model picker entries
- `RECORDER_KV` — KV binding for workspace persistence

Locally these come from `.dev.vars` and `wrangler.toml` `[vars]`; in production from secrets, `[vars]`, and dashboard bindings.

## Key Implementation Notes

- Functions use **only Workers-runtime APIs** (`fetch`, `Response`, `Headers`, `URL`, `btoa`, `request.formData()`, `TextDecoder`) — no Node built-ins, no `fs`, no Express/Multer.
- Transcription: audio is read in-memory, base64-encoded, and sent to OpenRouter as an `input_audio` content part. Mic recordings are decoded and re-encoded to real WAV PCM in the browser (`blobToWavBase64`) before upload, so `format: 'wav'` is accurate.
- Chat streams via SSE — the Function returns the upstream OpenRouter `ReadableStream` body directly.
- Workspace persistence requires `RECORDER_KV`. Without it, reads return the default workspace and saves return HTTP 503 (the UI shows "save failed").
- LLM never modifies existing workspace content — only appends after a `---` divider.
- Auto-save is debounced (~700ms) and POSTs the workspace markdown to KV.
- Errors from chat display in the chat panel; errors from transcription display in the left upload card.

## Client-side model overrides

The **Settings** dialog lets the user pick or type a custom STT model and LLM model (in addition to BYOK). Both are stored in `localStorage` only:

- **STT model** (`project-recorder.stt-model`) — sent to `/api/transcribe` as the `X-STT-Model` header; the Function prefers it over the server `STT_MODEL`, and falls back to the server default when the header is absent/blank.
- **LLM model** (`project-recorder.llm-model`) — sent in the `/api/chat` body as `model`; also drives the chat panel's model picker (which shows a typed id as a "custom" option). Blank resets to the first server-configured model.
