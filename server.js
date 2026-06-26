const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { streamChat, transcribeAudio, validateCredentials } = require('./lib/openrouter');

// --- Config ---
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WORKSPACE_PATH = path.join(__dirname, 'data', 'workspace.md');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PORT = process.env.PORT || 3000;

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('config.json not found. Copy config.example.json to config.json and fill in your API keys.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

const config = loadConfig();

// Ensure directories exist
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function getByokApiKey(req) {
  return (req.get('X-OpenRouter-Api-Key') || '').trim();
}

// --- Express App ---
const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '5mb', type: 'text/plain' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// --- GET /api/config ---
app.get('/api/config', (req, res) => {
  res.json({
    models: config.models || [],
    sttModel: config.sttModel || 'openrouter/auto',
    storage: 'filesystem',
    byokSupported: true,
  });
});

// --- GET /api/health ---
app.get('/api/health', async (req, res) => {
  const byok = !!getByokApiKey(req);
  const ok = await validateCredentials(config, getByokApiKey(req));
  res.json({ openrouter: ok, stt: ok, storage: 'filesystem', byok });
});

// --- GET /api/workspace ---
app.get('/api/workspace', (req, res) => {
  if (fs.existsSync(WORKSPACE_PATH)) {
    const content = fs.readFileSync(WORKSPACE_PATH, 'utf-8');
    res.type('text/plain').send(content);
  } else {
    res.type('text/plain').send('# Workspace\n\nStart **recording** or upload an audio file to begin transcription.\n\nYour transcribed text will appear here in real-time.\n');
  }
});

// --- POST /api/workspace ---
app.post('/api/workspace', (req, res) => {
  const content = typeof req.body === 'string' ? req.body : req.body.content;
  if (content == null) return res.status(400).json({ error: 'No content' });
  fs.writeFileSync(WORKSPACE_PATH, content, 'utf-8');
  res.json({ ok: true });
});

// --- POST /api/transcribe ---
// Accepts either multipart file upload or JSON with base64 audio
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    let base64Data, format, filename;

    if (req.file) {
      // File upload
      const fileBuf = fs.readFileSync(req.file.path);
      base64Data = fileBuf.toString('base64');
      filename = req.file.originalname;
      format = path.extname(filename).replace('.', '').toLowerCase() || 'wav';
      // Clean up
      try { fs.unlinkSync(req.file.path); } catch {}
    } else if (req.body.audio) {
      // Base64 JSON body (from mic recording)
      base64Data = req.body.audio;
      format = req.body.format || 'wav';
      filename = req.body.filename || 'recording';
    } else {
      return res.status(400).json({ error: 'No audio provided' });
    }

    const sttModel = config.sttModel || 'openrouter/auto';
    const text = await transcribeAudio(base64Data, format, sttModel, config, getByokApiKey(req));

    res.json({ text, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/chat ---
app.post('/api/chat', async (req, res) => {
  const { message, workspace, model } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const upstream = await streamChat(message, workspace || '', model || config.models?.[0]?.id, config, getByokApiKey(req));

    const reader = upstream.body;

    if (reader[Symbol.asyncIterator]) {
      for await (const chunk of reader) {
        const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        res.write(text);
      }
    } else if (reader.getReader) {
      const r = reader.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    }

    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --- Start ---
server.listen(PORT, () => {
  console.log(`Project Recorder running at http://localhost:${PORT}`);
});
