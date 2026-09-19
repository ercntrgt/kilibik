-- 0002_rls.sql : Row Level Security
-- Yazma islemleri sunucu tarafinda service_role ile yapilir (RLS'i bypass eder).
-- Tarayicidan gelen anon/authenticated istemci yalnizca okuyabilir.

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

alter table public.profiles       enable row level security;
alter table public.settings       enable row level security;
alter table public.campaigns      enable row level security;
alter table public.recipients     enable row level security;
alter table public.messages       enable row level security;
alter table public.message_events enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- settings ------------------------------------------------------------------
drop policy if exists settings_select_member on public.settings;
create policy settings_select_member on public.settings
  for select to authenticated
  using (public.is_active_member());

drop policy if exists settings_update_admin on public.settings;
create policy settings_update_admin on public.settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- veri tablolari: okuma aktif kullaniciya acik, yazma yalnizca service_role ----
drop policy if exists campaigns_select_member on public.campaigns;
create policy campaigns_select_member on public.campaigns
  for select to authenticated using (public.is_active_member());

drop policy if exists recipients_select_member on public.recipients;
create policy recipients_select_member on public.recipients
  for select to authenticated using (public.is_active_member());

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
  for select to authenticated using (public.is_active_member());

drop policy if exists message_events_select_member on public.message_events;
create policy message_events_select_member on public.message_events
  for select to authenticated using (public.is_active_member());

-- Hassas fonksiyonlar anon rolunden kapali
revoke execute on function public.claim_messages(uuid, integer, integer)       from anon, authenticated;
revoke execute on function public.apply_message_status(text, public.message_status, timestamptz, text, text, text, jsonb) from anon, authenticated;
revoke execute on function public.refresh_campaign_status(uuid)                from anon, authenticated;
revoke execute on function public.recent_send_exists(text, text, text, integer) from anon, authenticated;
