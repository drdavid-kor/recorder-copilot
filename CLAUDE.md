# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Recorder** is a single-page speech-to-text (STT) workspace tool. Users upload audio files or record via microphone, transcribe using Volcano Engine ASR APIs, and process transcriptions with an LLM via OpenRouter.

## Setup & Run

```bash
npm install
cp config.example.json config.json   # Fill in API keys
node server.js                        # http://localhost:3000
```

## Project Structure

- `server.js` — Express backend with all REST + WebSocket routes
- `public/index.html` — Single-page React frontend (React 18 via CDN, no build step)
- `lib/volcengine-file.js` — File ASR: submit + poll workflow
- `lib/volcengine-stream.js` — Streaming ASR: binary WebSocket protocol relay
- `lib/openrouter.js` — LLM chat proxy with SSE streaming
- `config.json` — API keys and model list (gitignored)
- `data/workspace.md` — Auto-saved workspace content (gitignored)
- `docs/prd.md` — Product Requirements Document (source of truth)

## Architecture

**Frontend:** Single-page React app served by the backend. Three-column layout:
- **Left panel**: Mic recording, audio upload (drag-drop), device selector, API status
- **Center panel**: Markdown workspace (textarea + pre sync-scroll with syntax highlighting)
- **Right panel**: LLM chat with model selector

**Backend:** Local Node.js server that:
- Proxies Volcengine ASR and OpenRouter LLM calls (API keys never exposed to browser)
- Serves uploaded audio files at temp localhost URLs for the file ASR API
- Handles workspace auto-save to `.md` file on disk
- Reads `config.json` for all configuration

**Data flow:** Audio → Backend → Volcengine ASR → transcription text → Workspace. User prompt → Backend → OpenRouter LLM (streaming) → chat panel → appended to workspace.

## External APIs

1. **Volcengine ASR v3 Bigmodel** — File recognition (`/api/v3/auc/bigmodel/submit` + `/query`) and streaming recognition (`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`). Auth: `X-Api-App-Key` + `X-Api-Access-Key`.
2. **OpenRouter API** — OpenAI-compatible `/chat/completions` with SSE streaming. Auth: Bearer token.

## Configuration

All config in `config.json` at project root. No settings UI. Contains Volcengine credentials, OpenRouter credentials + URL, and the LLM model list.

## Key Implementation Notes

- File ASR is a submit-then-poll workflow: submit audio URL → poll every 2s → status `20000000` = done
- Streaming ASR uses a custom binary WebSocket protocol (4-byte header + gzip payloads). The backend handles this complexity; the browser streams raw PCM to the backend via a simpler WebSocket.
- Audio capture: 16000 Hz, PCM 16-bit mono, 200ms chunks
- Auto-save: debounced 700ms, backend writes to `.md` file on disk
- LLM never modifies existing workspace content — only appends after `---` divider with auto-generated heading
- LLM streams tokens into chat panel; workspace append happens on completion
- Errors from LLM display in chat panel; errors from ASR display in the left panel upload card
