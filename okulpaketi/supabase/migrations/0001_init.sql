-- AtlasELT / OkulPaketi - WhatsApp toplu bilgilendirme
-- 0001_init.sql : tipler, tablolar, indeksler, gorunumler, fonksiyonlar

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- tipler
do $$ begin
  create type public.user_role        as enum ('admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.send_mode        as enum ('test', 'live');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status  as enum ('draft', 'ready', 'sending', 'paused', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  -- valid              : gonderime uygun
  -- invalid            : zorunlu alan eksik / telefon gecersiz
  -- duplicate          : ayni dosyada tekrar eden numara
  -- duplicate_previous : yakin gecmiste ayni icerikle zaten gonderilmis
  create type public.recipient_status as enum ('valid', 'invalid', 'duplicate', 'duplicate_previous');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_status   as enum ('pending', 'processing', 'sent', 'delivered', 'read', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       public.user_role not null default 'staff',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- auth.users -> profiles otomatik eslesme
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case when (select count(*) from public.profiles) = 0 then 'admin'::public.user_role
         else 'staff'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- settings (tek satir)
create table if not exists public.settings (
  id                  boolean primary key default true,
  template_name       text not null default 'set_teslim_bildirimi',
  template_language   text not null default 'tr',
  send_mode           public.send_mode not null default 'test',
  test_phone_e164     text,
  batch_size          integer not null default 50  check (batch_size between 1 and 200),
  throttle_per_second integer not null default 15  check (throttle_per_second between 1 and 80),
  dedupe_window_hours integer not null default 24  check (dedupe_window_hours between 0 and 8760),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles (id) on delete set null,
  constraint settings_singleton check (id)
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------- campaigns
create table if not exists public.campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  file_name         text,
  created_by        uuid references public.profiles (id) on delete set null,
  template_name     text not null,
  template_language text not null,
  send_mode         public.send_mode not null,
  test_phone_e164   text,
  status            public.campaign_status not null default 'ready',
  total_rows        integer not null default 0,
  valid_count       integer not null default 0,
  invalid_count     integer not null default 0,
  duplicate_count   integer not null default 0,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz
);

create index if not exists campaigns_created_at_idx on public.campaigns (created_at desc);
create index if not exists campaigns_status_idx     on public.campaigns (status);

-- ---------------------------------------------------------------- recipients
create table if not exists public.recipients (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  row_number     integer not null,
  raw_phone      text,
  phone_e164     text,
  alici_tipi     text,
  set_adi        text,
  teslim_tarihi  text,
  teslim_saati   text,
  teslim_noktasi text,
  status         public.recipient_status not null,
  issues         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists recipients_campaign_idx       on public.recipients (campaign_id);
create index if not exists recipients_phone_idx          on public.recipients (phone_e164);
create index if not exists recipients_set_adi_idx        on public.recipients (campaign_id, set_adi);
create index if not exists recipients_teslim_noktasi_idx on public.recipients (campaign_id, teslim_noktasi);

-- Ayni kampanyada bir numara yalnizca bir kez "gonderilebilir" olabilir.
create unique index if not exists recipients_campaign_phone_valid_uniq
  on public.recipients (campaign_id, phone_e164)
  where status = 'valid';

-- ---------------------------------------------------------------- messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns (id) on delete cascade,
  recipient_id    uuid not null unique references public.recipients (id) on delete cascade,
  -- idempotency: kayit basina tek satir; tekrar gonderim ayni satiri gunceller.
  idempotency_key text not null unique,
  to_phone_e164   text not null,
  is_test_redirect boolean not null default false,
  status          public.message_status not null default 'pending',
  wamid           text unique,
  attempt_count   integer not null default 0,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  failed_at       timestamptz,
  error_code      text,
  error_title     text,
  error_detail    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists messages_campaign_status_idx on public.messages (campaign_id, status);
create index if not exists messages_wamid_idx           on public.messages (wamid);
create index if not exists messages_sent_at_idx         on public.messages (sent_at desc);

-- ---------------------------------------------------------------- message_events
create table if not exists public.message_events (
  id          bigserial primary key,
  message_id  uuid references public.messages (id) on delete cascade,
  wamid       text,
  event_type  text not null,
  status      public.message_status,
  error_code  text,
  error_detail text,
  raw         jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists message_events_message_idx on public.message_events (message_id, occurred_at desc);

-- Webhook tekrar denemelerinde ayni olayi iki kez yazma.
create unique index if not exists message_events_dedupe_uniq
  on public.message_events (wamid, event_type, occurred_at)
  where wamid is not null;

-- ---------------------------------------------------------------- gorunumler
create or replace view public.campaign_stats
with (security_invoker = on) as
select
  c.id                                                            as campaign_id,
  count(m.id)                                                     as total_messages,
  count(m.id) filter (where m.status in ('pending', 'processing')) as pending_count,
  count(m.id) filter (where m.status = 'sent')                     as sent_only_count,
  count(m.id) filter (where m.status in ('sent', 'delivered', 'read')) as sent_count,
  count(m.id) filter (where m.status in ('delivered', 'read'))     as delivered_count,
  count(m.id) filter (where m.status = 'read')                     as read_count,
  count(m.id) filter (where m.status = 'failed')                   as failed_count
from public.campaigns c
left join public.messages m on m.campaign_id = c.id
group by c.id;

-- ---------------------------------------------------------------- fonksiyonlar

-- Panel ozet sayilari
create or replace function public.dashboard_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'total',      (select count(*) from public.messages),
    'today',      (select count(*) from public.messages where sent_at >= date_trunc('day', now())),
    'sent',       (select count(*) from public.messages where status in ('sent', 'delivered', 'read')),
    'delivered',  (select count(*) from public.messages where status in ('delivered', 'read')),
    'read',       (select count(*) from public.messages where status = 'read'),
    'failed',     (select count(*) from public.messages where status = 'failed'),
    'pending',    (select count(*) from public.messages where status in ('pending', 'processing')),
    'campaigns',  (select count(*) from public.campaigns)
  );
$$;

-- Toplu gonderim icin guvenli kayit "kapma".
-- Ayni anda iki istek calissa bile bir mesaj yalnizca bir kez alinir (SKIP LOCKED).
create or replace function public.claim_messages(
  p_campaign_id   uuid,
  p_limit         integer,
  p_stale_minutes integer default 5
)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.messages m
     set status        = 'processing',
         claimed_at    = now(),
         attempt_count = m.attempt_count + 1,
         updated_at    = now()
   where m.id in (
     select x.id
       from public.messages x
      where x.campaign_id = p_campaign_id
        and (
          x.status = 'pending'
          or (x.status = 'processing' and x.claimed_at < now() - make_interval(mins => p_stale_minutes))
        )
      order by x.created_at
      limit greatest(p_limit, 0)
      for update skip locked
   )
  returning m.*;
end $$;

-- Durum siralamasi: geriye dusme olmaz (read gelmisken delivered yazilmaz).
create or replace function public.message_status_rank(s public.message_status)
returns integer
language sql
immutable
as $$
  select case s
    when 'pending'    then 0
    when 'processing' then 1
    when 'sent'       then 2
    when 'delivered'  then 3
    when 'read'       then 4
    when 'failed'     then 5
  end;
$$;

-- Webhook olayini uygular: olayi yazar, durumu yalnizca ileri yonde gunceller.
create or replace function public.apply_message_status(
  p_wamid       text,
  p_status      public.message_status,
  p_occurred_at timestamptz,
  p_error_code  text default null,
  p_error_title text default null,
  p_error_detail text default null,
  p_raw         jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages%rowtype;
begin
  select * into v_message from public.messages where wamid = p_wamid;
  if not found then
    insert into public.message_events (message_id, wamid, event_type, status, error_code, error_detail, raw, occurred_at)
    values (null, p_wamid, 'status:' || p_status::text, p_status, p_error_code, p_error_detail, p_raw, p_occurred_at)
    on conflict do nothing;
    return null;
  end if;

  insert into public.message_events (message_id, wamid, event_type, status, error_code, error_detail, raw, occurred_at)
  values (v_message.id, p_wamid, 'status:' || p_status::text, p_status, p_error_code, p_error_detail, p_raw, p_occurred_at)
  on conflict do nothing;

  update public.messages m
     set status       = case when public.message_status_rank(p_status) > public.message_status_rank(m.status)
                             then p_status else m.status end,
         sent_at      = case when p_status = 'sent'      then coalesce(m.sent_at, p_occurred_at)      else m.sent_at end,
         delivered_at = case when p_status = 'delivered' then coalesce(m.delivered_at, p_occurred_at) else m.delivered_at end,
         read_at      = case when p_status = 'read'      then coalesce(m.read_at, p_occurred_at)      else m.read_at end,
         failed_at    = case when p_status = 'failed'    then coalesce(m.failed_at, p_occurred_at)    else m.failed_at end,
         error_code   = case when p_status = 'failed'    then coalesce(p_error_code, m.error_code)    else m.error_code end,
         error_title  = case when p_status = 'failed'    then coalesce(p_error_title, m.error_title)  else m.error_title end,
         error_detail = case when p_status = 'failed'    then coalesce(p_error_detail, m.error_detail) else m.error_detail end,
         updated_at   = now()
   where m.id = v_message.id;

  return v_message.id;
end $$;

-- Kampanya durumunu mesaj sayaclarina gore tazeler.
create or replace function public.refresh_campaign_status(p_campaign_id uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending integer;
  v_total   integer;
  v_status  public.campaign_status;
begin
  select count(*) filter (where status in ('pending', 'processing')), count(*)
    into v_pending, v_total
    from public.messages where campaign_id = p_campaign_id;

  if v_total = 0 then
    v_status := 'ready';
  elsif v_pending > 0 then
    v_status := 'sending';
  else
    v_status := 'completed';
  end if;

  update public.campaigns
     set status       = v_status,
         completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else null end
   where id = p_campaign_id
     and status <> 'cancelled';

  return v_status;
end $$;

-- Gecmis gonderim tekrarini engelleme kontrolu (idempotency penceresi).
create or replace function public.recent_send_exists(
  p_phone   text,
  p_set_adi text,
  p_tarih   text,
  p_hours   integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.messages m
      join public.recipients r on r.id = m.recipient_id
     where r.phone_e164 = p_phone
       and coalesce(r.set_adi, '')       = coalesce(p_set_adi, '')
       and coalesce(r.teslim_tarihi, '') = coalesce(p_tarih, '')
       and m.status in ('sent', 'delivered', 'read')
       and m.sent_at >= now() - make_interval(hours => p_hours)
  );
$$;
