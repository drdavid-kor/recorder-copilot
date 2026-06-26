import { getConfig } from './config.js';

export const SYSTEM_PROMPT = 'You are a text-processing assistant. The user has a Markdown workspace with transcribed audio. Process it per their request. Return ONLY the processed output as Markdown. No preamble or explanation.';

function requestHeaders(config, request) {
  const origin = new URL(request.url).origin;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.openrouter.apiKey}`,
    'HTTP-Referer': origin,
    'X-Title': 'Project Recorder',
  };
}

export async function transcribeAudio(base64Data, format, model, env, request) {
  const config = getConfig(env, request);
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const res = await fetch(`${config.openrouter.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: requestHeaders(config, request),
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
                format,
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

export async function streamChat(userMessage, workspaceContent, model, env, request) {
  const config = getConfig(env, request);
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Workspace:\n\`\`\`markdown\n${workspaceContent}\n\`\`\`\n\nRequest: ${userMessage}`,
    },
  ];

  const res = await fetch(`${config.openrouter.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: requestHeaders(config, request),
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

export async function validateCredentials(env, request) {
  const config = getConfig(env, request);
  if (!config.openrouter.apiKey) return false;

  try {
    const res = await fetch(`${config.openrouter.apiUrl}/key`, {
      headers: { 'Authorization': `Bearer ${config.openrouter.apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
