const SYSTEM_PROMPT = `You are a text-processing assistant. The user has a Markdown workspace with transcribed audio. Process it per their request. Return ONLY the processed output as Markdown. No preamble or explanation.`;

async function transcribeAudio(base64Data, format, model, config) {
  const url = `${config.openrouter.apiUrl}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouter.apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Project Recorder',
    },
    body: JSON.stringify({
      model,
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
              input_audio: {
                data: base64Data,
                format: format,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function streamChat(userMessage, workspaceContent, model, config) {
  const url = `${config.openrouter.apiUrl}/chat/completions`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Workspace:\n\`\`\`markdown\n${workspaceContent}\n\`\`\`\n\nRequest: ${userMessage}`,
    },
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouter.apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Project Recorder',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  return res;
}

async function validateCredentials(config) {
  if (!config.openrouter?.apiKey) return false;
  try {
    const res = await fetch(`${config.openrouter.apiUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.openrouter.apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { transcribeAudio, streamChat, validateCredentials, SYSTEM_PROMPT };
