# Project Recorder — Product Requirements Document

A single-page **speech-to-text** (STT) workspace tool. Users upload audio files or record via microphone, transcribe using Volcano Engine ASR, and process transcriptions with an LLM via OpenRouter.

Refer to `./docs/design/Project Recorder.html` for the UI design prototype.

---

## Architecture

### Frontend
A single-page React application served by the backend. The UI is a three-column layout:
- **Left column** (narrow): Mic recording button and timer at the top, audio file upload zone (drag-and-drop or click) below, mic device selector and API connection status indicators at the bottom.
- **Center column** (main): A real-time rendered Markdown workspace. Editable. Toolbar shows auto-save status and an Export button.
- **Right column** (sidebar): LLM chat panel. User input field at the bottom, model selector dropdown above the chat history.

### Backend
A local **Node.js** server that:
1. Serves the frontend static files.
2. Proxies all external API calls (Volcengine ASR, OpenRouter LLM) so that API keys are never exposed to the browser.
3. Serves uploaded audio files at temporary localhost URLs for the Volcengine file ASR API.
4. Reads `config.json` for all configuration.
5. Handles auto-save of workspace content to a `.md` file on disk.

### Configuration
All configuration lives in `config.json` at the project root. No settings UI on the webpage. Fields:

```json
{
  "volcengine": {
    "appKey": "",
    "accessKey": ""
  },
  "openrouter": {
    "apiKey": "",
    "apiUrl": "https://openrouter.ai/api/v1"
  },
  "models": [
    { "id": "openai/gpt-4o", "label": "GPT-4o" },
    { "id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet" }
  ]
}
```

The backend reads this file on startup. The frontend fetches the config (minus secrets) from a backend endpoint to populate the model selector and determine connection status.

---

## Features

### 1. File Transcription

The user uploads an audio file (mp3, wav, m4a, ogg). The system transcribes it via **Volcengine ASR v3 Bigmodel** and outputs the text to the workspace.

**API details (Volcengine v3 Bigmodel — file recognition):**
- Docs: https://www.volcengine.com/docs/6561/1354868
- Submit endpoint: `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit`
- Query endpoint: `POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query`
- Auth headers: `X-Api-App-Key`, `X-Api-Access-Key`, `X-Api-Resource-Id: volc.bigasr.auc`, `X-Api-Request-Id: <uuid>`
- Request body (submit): `{ "user": { "uid": "..." }, "audio": { "url": "<localhost-url>", "format": "mp3" }, "request": { "model_name": "bigmodel", "enable_itn": true, "enable_punc": true } }`
- Workflow: submit → poll query endpoint every 2s → status `20000000` means complete → extract `result.text` and `result.utterances`

**Flow:**
1. User uploads file via the left panel (drag-drop or click).
2. Frontend sends the file to the backend.
3. Backend saves the file to a temp directory, serves it at a localhost URL.
4. Backend calls the Volcengine submit endpoint with that URL.
5. Backend polls the query endpoint every 2 seconds until complete or failed.
6. On success, backend returns the transcription text to the frontend.
7. Frontend appends the transcription to the workspace with a `---` divider and a heading: `# Transcription — <filename>`.
8. Left panel shows file name, processing status (processing… / transcribed).

**Error handling:** Display errors in the upload card on the left panel (e.g., "ASR failed: invalid audio format").

### 2. Streaming Transcription (Microphone)

The user records via microphone. The system streams audio to **Volcengine Streaming ASR** and outputs recognized text to the workspace in real time.

**API details (Volcengine v3 Bigmodel — streaming recognition):**
- Docs: https://www.volcengine.com/docs/6561/1354869
- WebSocket endpoint: `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`
- Auth headers on connection: `X-Api-App-Key`, `X-Api-Access-Key`
- Binary frame protocol: 4-byte header (version, message type, serialization, compression) + 4-byte payload size (big-endian) + gzip-compressed payload
- Session lifecycle:
  1. Open WebSocket connection with auth headers.
  2. Send full client request (JSON, gzip-compressed): audio format (PCM), sample rate (16000), channels (1), `enable_itn`, `enable_punc`.
  3. Server acknowledges.
  4. Stream audio chunks every 100-200ms (raw PCM, gzip-compressed).
  5. Receive partial recognition results (`.delta` events) and final results (`.result` events).
  6. Send end-of-stream marker to close session.

**Flow:**
1. User clicks the Record button. Frontend starts capturing audio from the selected mic device using `navigator.mediaDevices.getUserMedia()` with `{ audio: { sampleRate: 16000, channelCount: 1 } }`.
2. Frontend streams raw PCM audio chunks to the backend via a WebSocket connection.
3. Backend relays chunks to Volcengine Streaming ASR via its own WebSocket connection (handling the binary protocol).
4. Backend forwards partial/final recognition results back to the frontend.
5. Frontend updates the workspace in real time: partial results replace the current line, final results are committed.
6. On stop, the transcription is finalized under a `---` divider and heading: `# Transcription — Recording <n>`.
7. During recording, the left panel shows a waveform animation and elapsed time.

**Audio capture:**
- Sample rate: 16000 Hz
- Format: PCM 16-bit mono
- Chunk interval: 200ms

### 3. LLM Editor Agent

The user chats with an LLM in the right sidebar. The LLM reads the current workspace content and writes its response back to the workspace.

**API details (OpenRouter):**
- Endpoint: `{config.openrouter.apiUrl}/chat/completions` (default: `https://openrouter.ai/api/v1/chat/completions`)
- Auth: `Authorization: Bearer {config.openrouter.apiKey}`
- Standard OpenAI-compatible chat completions format.
- Streaming: enabled (`"stream": true`). The backend proxies the SSE stream to the frontend.

**Behavior:**
- The LLM receives the full workspace content as context plus the user's message.
- The LLM response streams token-by-token into the chat panel.
- Once streaming is complete, the full response is appended to the workspace after a `---` divider and an auto-generated first-level heading (the LLM determines the heading based on the user's request).
- The LLM **never modifies existing workspace content** — it only appends.
- The user can select which model to use from the dropdown (populated from `config.models`).
- Errors are displayed directly in the chat panel as an error message (not in the workspace).

### 4. Auto-Save

The workspace content is automatically saved to a Markdown file on disk after each edit.

- Save target: a `.md` file on disk, managed by the backend.
- Debounce: save 700ms after the last keystroke (avoid excessive writes).
- The backend exposes an endpoint for the frontend to POST workspace content; the backend writes it to disk.
- On page load, the frontend fetches the last saved content from the backend.
- The toolbar shows save status: "saving…" during debounce, "saved" after write completes.

### 5. Manual Export

When the user clicks the **Export .md** button in the workspace toolbar, open a browser Save-As dialog to download the current workspace content as a `.md` file.

This is a client-side operation (Blob URL download) — no backend involvement needed.

### 6. Status Indicators

The bottom of the left panel shows connection status for:
- **Volcano ASR**: green "ok" if the backend confirms valid Volcengine credentials on startup; red "err" otherwise.
- **OpenRouter**: green "ok" if the backend confirms valid OpenRouter credentials on startup; red "err" otherwise.

The frontend fetches status from a backend health-check endpoint on page load.

---

## API Endpoints (Backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/` | Serve the frontend |
| `GET`  | `/api/config` | Return non-secret config (model list, status) |
| `GET`  | `/api/health` | Return Volcengine & OpenRouter connection status |
| `GET`  | `/api/workspace` | Return the last saved workspace content |
| `POST` | `/api/workspace` | Save workspace content to disk |
| `POST` | `/api/transcribe/file` | Upload audio file, start file ASR, return transcription |
| `WS`   | `/api/transcribe/stream` | WebSocket for streaming ASR (browser ↔ backend ↔ Volcengine) |
| `POST` | `/api/chat` | Proxy LLM chat completion (SSE streaming response) |
