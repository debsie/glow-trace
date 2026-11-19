-- pg_net belongs in the extensions schema (Supabase security advisor); its functions stay in net.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
