const SYSTEM_PROMPT = 'You are a text-processing assistant. The user has a Markdown workspace with transcribed audio. Process it per their request. Return ONLY the processed output as Markdown. No preamble or explanation.';

export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENROUTER_API_KEY;
  const apiUrl = env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';

  let models = [];
  try { models = JSON.parse(env.MODELS || '[]'); } catch {}

  try {
    const { message, workspace, model } = await request.json();
    if (!message) {
      return Response.json({ error: 'No message' }, { status: 400 });
    }

    const upstream = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://recorder-copilot.pages.dev',
        'X-Title': 'Project Recorder',
      },
      body: JSON.stringify({
        model: model || models[0]?.id || 'openrouter/auto',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Workspace:\n\`\`\`markdown\n${workspace || ''}\n\`\`\`\n\nRequest: ${message}`,
          },
        ],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(`data: ${JSON.stringify({ error: `OpenRouter error ${upstream.status}: ${text}` })}\n\n`, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Pipe the SSE stream through
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return new Response(`data: ${JSON.stringify({ error: err.message })}\n\n`, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
