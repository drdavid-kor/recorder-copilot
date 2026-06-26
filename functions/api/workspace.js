import { json, text } from '../_shared/http.js';

const WORKSPACE_KEY = 'workspace.md';
const DEFAULT_WORKSPACE = '# Workspace\n\nStart **recording** or upload an audio file to begin transcription.\n\nYour transcribed text will appear here in real-time.\n';

function getWorkspaceStore(env) {
  return env.RECORDER_KV;
}

export async function onRequestGet({ env }) {
  const store = getWorkspaceStore(env);
  if (!store) {
    return text(DEFAULT_WORKSPACE, {
      headers: { 'X-Recorder-Storage': 'missing' },
    });
  }

  const content = await store.get(WORKSPACE_KEY);
  return text(content || DEFAULT_WORKSPACE, {
    headers: { 'X-Recorder-Storage': 'kv' },
  });
}

export async function onRequestPost({ request, env }) {
  const store = getWorkspaceStore(env);
  if (!store) {
    return json({ error: 'RECORDER_KV binding is required for Cloudflare workspace persistence' }, { status: 503 });
  }

  const contentType = request.headers.get('Content-Type') || '';
  let content;

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    content = body?.content;
  } else {
    content = await request.text();
  }

  if (content == null) {
    return json({ error: 'No content' }, { status: 400 });
  }

  await store.put(WORKSPACE_KEY, content);
  return json({ ok: true, storage: 'kv' });
}

