-- Run once in Supabase: SQL Editor > New query > paste > Run

create table public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  lv int not null default 1,
  area int not null default 0,
  wins int not null default 0
);
create unique index players_name_ci on public.players (lower(name));

create table public.saves (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.saves   enable row level security;

-- everyone can read the leaderboard; you can only touch your own row
create policy "players read"   on public.players for select using (true);
create policy "players insert" on public.players for insert with check (auth.uid() = id);
create policy "players update" on public.players for update using (auth.uid() = id) with check (auth.uid() = id);

-- saves are private to the owner
create policy "saves read"   on public.saves for select using (auth.uid() = id);
create policy "saves insert" on public.saves for insert with check (auth.uid() = id);
create policy "saves update" on public.saves for update using (auth.uid() = id) with check (auth.uid() = id);

-- basic anti-cheat: stats can't jump unrealistically between saves
create function public.limit_progress() returns trigger language plpgsql as $$
begin
  if new.lv > 99 or new.area > 4 then raise exception 'invalid stats'; end if;
  if new.lv   > old.lv + 4   then raise exception 'level jump'; end if;
  if new.area > old.area + 1 then raise exception 'area jump'; end if;
  if new.wins > old.wins + 1 then raise exception 'wins jump'; end if;
  return new;
end $$;
create trigger players_limit before update on public.players
  for each row execute function public.limit_progress();
