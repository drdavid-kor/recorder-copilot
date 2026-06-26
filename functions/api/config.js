import { publicConfig } from '../_shared/config.js';
import { json } from '../_shared/http.js';

export async function onRequestGet({ env }) {
  return json(publicConfig(env));
}

