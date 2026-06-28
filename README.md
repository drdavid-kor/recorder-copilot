# Project Recorder

A single-page speech-to-text (STT) workspace. Upload audio or record from the mic, transcribe via an OpenRouter audio model, then iterate on the transcript with an LLM in a side-by-side chat panel.

It runs on **Cloudflare Pages + Pages Functions**: `public/` is served as static assets and the `/api/*` backend lives in `functions/`.

The app supports BYOK (bring your own key): users can paste an OpenRouter API key in the frontend Settings dialog. The key is stored only in that browser's `localStorage` and sent with transcription/chat API calls; the backend does not persist it.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars       # fill in OPENROUTER_API_KEY
npm run dev                          # http://localhost:8788
```

`npm run dev` runs `wrangler pages dev` with a local ephemeral `RECORDER_KV` namespace, so workspace save/load works offline.

## Deploy to Cloudflare Pages

Workspace persistence needs a KV namespace bound as `RECORDER_KV`. Pick one of:

**CLI / Direct Upload**

```bash
npm run kv:create        # prints a namespace id
# edit wrangler.toml: uncomment the [[kv_namespaces]] block and paste the id
npm run deploy           # wrangler pages deploy (output dir comes from wrangler.toml)
```

**Git-connected Pages project**

- Build command: `npm run build`
- Build output directory: `public`
- Bind a KV namespace as `RECORDER_KV` in **Settings → Functions → KV namespace bindings**
- Add `OPENROUTER_API_KEY` as a secret (skip for BYOK-only)

> Use `wrangler pages deploy`, **not** `wrangler deploy` — the latter targets Workers and fails without a Worker entrypoint. See `docs/deployment/cloudflare.md`.

## Configuration

The backend is configured through Cloudflare environment variables (locally via `.dev.vars` + `wrangler.toml` `[vars]`):

- `OPENROUTER_API_KEY` — server-funded OpenRouter key (secret). Optional for BYOK-only.
- `OPENROUTER_API_URL` — base URL (defaults to `https://openrouter.ai/api/v1`)
- `STT_MODEL` — OpenRouter model id used for transcription
- `MODELS_JSON` — JSON array of `{ id, label }` entries shown in the chat model picker
- `RECORDER_KV` — KV binding for `workspace.md` persistence

If no server-side key is configured, users can still use the app by opening **Settings** and saving their own OpenRouter key locally.

## How it works

- **Left panel** — mic recording, audio file upload (drag-drop), API status, BYOK settings
- **Center panel** — markdown workspace, auto-saved to KV
- **Right panel** — LLM chat with model selector; replies are appended to the workspace below a `---` divider
- **Settings** — optional BYOK OpenRouter API key saved in browser local storage

The Pages Functions proxy all OpenRouter calls so the server key never reaches the browser. Chat responses stream via SSE.

## Project layout

- `public/index.html` — single-page React UI (React 18 via CDN, no build step)
- `functions/api/*.js` — Pages Functions for each `/api/*` route
- `functions/_shared/*.js` — shared config / HTTP / OpenRouter helpers
- `wrangler.toml` — Cloudflare Pages/Functions configuration (output dir, `[vars]`, KV binding)
- `.dev.vars.example` — local Cloudflare secrets template
- `docs/deployment/cloudflare.md` — Cloudflare setup guide
- `docs/prd.md` — product requirements
