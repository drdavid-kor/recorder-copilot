import { getConfig } from '../_shared/config.js';
import { json, sseError } from '../_shared/http.js';
import { streamChat } from '../_shared/openrouter.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  const message = body?.message;

  if (!message) {
    return json({ error: 'No message' }, { status: 400 });
  }

  try {
    const config = getConfig(env, request);
    const upstream = await streamChat(
      message,
      body.workspace || '',
      body.model || config.models?.[0]?.id,
      env,
      request,
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return sseError(err.message);
  }
}
