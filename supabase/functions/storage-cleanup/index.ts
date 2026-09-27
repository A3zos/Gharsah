// storage-cleanup: called daily by pg_cron with the x-cron-secret header.
// Deletes the recordings queued in storage_cleanup_queue (deleted submissions or
// children, recordings older than 90 days, orphan uploads). Replaces the
// Firebase scheduledCleanup's storage part.
import { admin, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json(req, 401, { error: 'unauthenticated' });
  const db = admin();
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data: rows, error } = await db
      .from('storage_cleanup_queue')
      .select('id, path')
      .eq('bucket', 'recordings')
      .order('id')
      .limit(100);
    if (error) return json(req, 500, { error: error.message });
    if (!rows?.length) break;
    const { error: rmError } = await db.storage.from('recordings').remove(rows.map((r) => r.path));
    if (rmError) return json(req, 500, { error: rmError.message, removed });
    await db
      .from('storage_cleanup_queue')
      .delete()
      .in(
        'id',
        rows.map((r) => r.id),
      );
    removed += rows.length;
  }
  return json(req, 200, { removed });
});
