export async function onRequestGet({ env }) {
  return Response.json({
    openrouter: !!env.OPENROUTER_API_KEY,
  });
}
