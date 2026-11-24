-- Lighting challenge: a shared training photo can say which light it was taken in, and three
-- photos taken together (daylight, indoor, dim) share a set id, so training can compare the same
-- face under different light. Both optional; the existing insert policy (own folder, active
-- consent) still applies, and nothing else about the table changes.
alter table public.training_photos
  add column if not exists lighting text check (lighting in ('daylight', 'indoor', 'dim')),
  add column if not exists set_id uuid;

create index if not exists training_photos_set_id_idx
  on public.training_photos (set_id)
  where set_id is not null;
