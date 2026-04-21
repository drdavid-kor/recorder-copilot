export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENROUTER_API_KEY;
  const apiUrl = env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
  const sttModel = env.STT_MODEL || 'openrouter/auto';

  try {
    let base64Data, format, filename;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audio');
      if (!file) {
        return Response.json({ error: 'No audio file' }, { status: 400 });
      }
      const arrayBuf = await file.arrayBuffer();
      base64Data = arrayBufferToBase64(arrayBuf);
      filename = file.name || 'upload';
      const ext = filename.split('.').pop().toLowerCase();
      format = ext || 'wav';
    } else {
      const body = await request.json();
      if (!body.audio) {
        return Response.json({ error: 'No audio provided' }, { status: 400 });
      }
      base64Data = body.audio;
      format = body.format || 'wav';
      filename = body.filename || 'recording';
    }

    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://recorder-copilot.pages.dev',
        'X-Title': 'Project Recorder',
      },
      body: JSON.stringify({
        model: sttModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe this audio accurately. Output ONLY the transcription text, nothing else. No labels, no timestamps, no commentary.',
              },
              {
                type: 'input_audio',
                input_audio: { data: base64Data, format },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Transcription failed (${res.status}): ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    return Response.json({ text, filename });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
