-- Kilibik şeması. DİKKAT: konum için tablo YOKTUR ve olmayacaktır (docs/RED_LINES.md).
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  auth_provider text not null,                 -- 'phone' | 'apple' | 'google'
  auth_provider_id text not null,              -- telefon için HMAC özeti; düz numara saklanmaz
  birth_date_verified boolean not null default false,  -- doğum tarihi saklanmaz, yalnızca 18+ doğrulandı bayrağı
  public_key bytea,                            -- X25519 açık anahtar (özel anahtar cihazdan çıkmaz)
  push_token text,
  push_platform text check (push_platform in ('ios', 'android')),
  deleted_at timestamptz,                      -- silme başladı (anonimleştirildi); purge job kalıcı siler
  unique (auth_provider, auth_provider_id)
);

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references users(id) on delete cascade,
  user_b_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  dissolved_at timestamptz,
  check (user_a_id <> user_b_id)
);
-- Bir kullanıcı aynı anda yalnızca bir aktif eşleşmede olabilir.
create unique index if not exists pairs_one_active_a on pairs(user_a_id) where dissolved_at is null;
create unique index if not exists pairs_one_active_b on pairs(user_b_id) where dissolved_at is null;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body_encrypted bytea not null,               -- sunucu içeriği okuyamaz
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'snoozed')),
  responded_at timestamptz                     -- yalnızca "yanıtlandı" göstermek için; toplulaştırılmaz
);
create index if not exists requests_pair_created on requests(pair_id, created_at desc);

create table if not exists sharing_state (
  user_id uuid primary key references users(id) on delete cascade,
  location_sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
  -- değişiklik LOGLANMAZ; yalnızca güncel durum
);

-- KVKK ispat yükü için rıza kaydı: (kullanıcı, tür) başına tek satır. Geri alma satırı siler; geçmiş tutulmaz.
create table if not exists consents (
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('privacy_notice', 'location')),
  version int not null,
  given_at timestamptz not null default now(),
  primary key (user_id, kind)
);
