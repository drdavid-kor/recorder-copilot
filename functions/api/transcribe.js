import { getConfig } from '../_shared/config.js';
import { json } from '../_shared/http.js';
import { transcribeAudio } from '../_shared/openrouter.js';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extensionFromFilename(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || '');
  return match ? match[1].toLowerCase() : 'wav';
}

export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    let base64Data;
    let format = 'wav';
    let filename = 'recording';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const audio = form.get('audio');

      if (!audio || typeof audio === 'string') {
        return json({ error: 'No audio provided' }, { status: 400 });
      }

      filename = audio.name || 'upload';
      format = extensionFromFilename(filename);
      base64Data = arrayBufferToBase64(await audio.arrayBuffer());
    } else {
      const body = await request.json().catch(() => null);

      if (!body?.audio) {
        return json({ error: 'No audio provided' }, { status: 400 });
      }

      base64Data = body.audio;
      format = body.format || 'wav';
      filename = body.filename || filename;
    }

    const config = getConfig(env, request);
    const sttModel = (request.headers.get('X-STT-Model') || '').trim() || config.sttModel;
    const text = await transcribeAudio(base64Data, format, sttModel, env, request);

    return json({ text, filename });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
