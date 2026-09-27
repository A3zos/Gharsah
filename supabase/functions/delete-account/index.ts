// delete-account: a signed-in PARENT deletes their own account («حذف الحساب»).
// Deleting the auth user cascades to parents → children → progress, stars,
// submissions (their recordings are queued for storage-cleanup), sessions, codes.
import { admin, caller, cors, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method-not-allowed' });
  const user = await caller(req);
  if (!user || user.is_anonymous) return json(req, 401, { error: 'unauthenticated' });
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) return json(req, 500, { error: 'internal' });
  return json(req, 200, { deleted: true });
});
