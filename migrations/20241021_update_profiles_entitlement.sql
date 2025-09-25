-- Ensure profiles table exists with entitlement tracking for premium exports
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'free',
  stripe_customer_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table profiles
  add column if not exists entitlement text not null default 'free';

alter table profiles
  add column if not exists stripe_customer_id text;

alter table profiles
  add column if not exists created_at timestamp with time zone not null default now();

alter table profiles
  add column if not exists updated_at timestamp with time zone not null default now();

create or replace function set_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_profiles_updated_at
  before update on profiles
  for each row
  execute function set_profiles_updated_at();

create index if not exists profiles_entitlement_idx on profiles (entitlement);
create index if not exists profiles_stripe_customer_idx on profiles (stripe_customer_id);
