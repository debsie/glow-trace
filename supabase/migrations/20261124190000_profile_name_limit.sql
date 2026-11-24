-- Profiles are now edited from Settings: keep names to 60 characters (what the app shows) and
-- never blank. Existing rows already fit (names were trimmed to 60 when shown).
update public.profiles set display_name = left(display_name, 60) where char_length(display_name) > 60;
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 60);
