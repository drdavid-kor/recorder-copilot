export async function onRequestGet({ env }) {
  let models = [];
  try {
    models = JSON.parse(env.MODELS || '[]');
  } catch {}

  return Response.json({
    models,
    sttModel: env.STT_MODEL || 'openrouter/auto',
  });
}
