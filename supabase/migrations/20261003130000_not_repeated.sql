-- «لم يُردَّد»: an ayah the child stayed silent on twice. The lesson then moves on
-- WITHOUT counting it as repeated (no praise, not memorized), and the parent sees it
-- marked «لم يُردَّد». Ayah refs «surah:ayah» — never in done_refs at the same time.
-- Set by the child's device (the web writes it only when non-empty and keeps saving
-- without it until this migration is deployed).
alter table public.progress add column not_repeated_refs text[] not null default '{}';
grant update (not_repeated_refs) on public.progress to authenticated;
