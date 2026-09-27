// claim-pairing-code: an ANONYMOUS child device enters the 6-digit code.
// 5 wrong codes / 10 min / device; codes are single-use and live 10 minutes.
// The demo code (is_demo) works only when the DEMO_MODE secret is "true".
import { admin, caller, cors, json, sqlError } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method-not-allowed' });
  const user = await caller(req);
  if (!user || !user.is_anonymous) return json(req, 401, { error: 'unauthenticated' });
  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code : '';
  const db = admin();
  const { data, error } = await db.rpc('claim_pairing_code', {
    p_device: user.id,
    p_code: code,
    p_demo_mode: Deno.env.get('DEMO_MODE') === 'true',
  });
  if (error) {
    // The failed call rolled back; count the wrong attempt on its own.
    if (error.message.includes('wrong-code') || error.message.includes('bad-code')) {
      await db.rpc('record_failed_claim', { p_device: user.id });
    }
    return sqlError(req, error.message);
  }
  return json(req, 200, data);
});
