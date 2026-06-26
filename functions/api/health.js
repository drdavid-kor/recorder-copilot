import { json } from '../_shared/http.js';
import { getByokApiKey } from '../_shared/config.js';
import { validateCredentials } from '../_shared/openrouter.js';

export async function onRequestGet({ request, env }) {
  const byok = !!getByokApiKey(request);
  const ok = await validateCredentials(env, request);

  return json({
    openrouter: ok,
    stt: ok,
    storage: env.RECORDER_KV ? 'kv' : 'missing',
    byok,
  });
}
