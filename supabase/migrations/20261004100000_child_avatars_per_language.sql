-- غَرْسة — child avatars per language (public/avatars/child-{en,id}-{boy,girl}-{1..4}.webp).
-- children.avatar may now also be 'en-boy-1'…'en-boy-4', 'en-girl-1'…'en-girl-4',
-- 'id-boy-1'…'id-boy-4', 'id-girl-1'…'id-girl-4' — still always of the child's own gender.
-- A parent may pick any set whatever the UI language, and a child keeps the chosen avatar
-- when the language changes. The trigger from 20261003120000_child_avatars stays as it is;
-- only the key function it calls widens (old keys, legacy ids and the gender rule unchanged).

create or replace function public.child_avatar_key(old text, g text)
returns text language sql immutable set search_path = '' as $$
  select case
    when old ~ '^((en|id)-)?(boy|girl)-[1-4]$'
         and regexp_replace(old, '^((en|id)-)?(boy|girl)-[1-4]$', '\3') = g then old
    when g = 'girl' then 'girl-' || case old when 'g2' then '2' when 'g3' then '3' when 'g4' then '4' else '1' end
    else 'boy-' || case old when 'b2' then '4' when 'b3' then '2' when 'b4' then '3' else '1' end
  end
$$;
