-- Live updates for the clients (replaces Firestore snapshots). Realtime applies
-- the same RLS policies: a client only receives changes to rows it may read.
alter publication supabase_realtime add table
  public.parents, public.children, public.subscriptions, public.child_sessions,
  public.progress, public.star_events, public.submissions;
