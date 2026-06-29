const DEFAULT_API_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_STT_MODEL = 'openai/gpt-audio-mini';
const DEFAULT_MODELS = [
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
  { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7' },
  { id: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast' },
];

function parseModels(raw) {
  if (!raw) return DEFAULT_MODELS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MODELS;

    return parsed
      .filter((model) => model && typeof model.id === 'string' && typeof model.label === 'string')
      .map((model) => ({ id: model.id, label: model.label }));
  } catch {
    return DEFAULT_MODELS;
  }
}

export function getByokApiKey(request) {
  return (request?.headers?.get('X-OpenRouter-Api-Key') || '').trim();
}

export function getConfig(env, request) {
  const byokApiKey = getByokApiKey(request);

  return {
    openrouter: {
      apiKey: byokApiKey || env.OPENROUTER_API_KEY || '',
      apiUrl: env.OPENROUTER_API_URL || DEFAULT_API_URL,
    },
    sttModel: env.STT_MODEL || DEFAULT_STT_MODEL,
    models: parseModels(env.MODELS_JSON),
    byok: !!byokApiKey,
  };
}

export function publicConfig(env) {
  const config = getConfig(env);
  return {
    models: config.models,
    sttModel: config.sttModel,
    storage: env.RECORDER_KV ? 'kv' : 'missing',
    byokSupported: true,
  };
}
