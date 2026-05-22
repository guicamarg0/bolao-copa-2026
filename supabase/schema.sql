create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  username text not null unique,
  display_name text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  add column if not exists username text;

with generated as (
  select
    id,
    coalesce(
      nullif(
        lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]', '', 'g')),
        ''
      ),
      'user'
    ) as base
  from public.profiles
  where username is null or btrim(username) = ''
),
ranked as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as rn
  from generated
)
update public.profiles p
set username =
  case
    when r.rn = 1 then r.base
    else r.base || r.rn::text
  end
from ranked r
where p.id = r.id;

create unique index if not exists idx_profiles_username_ci
  on public.profiles ((lower(username)));

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (
    stage in (
      'group',
      'round_of_32',
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'third_place',
      'final'
    )
  ),
  group_name text,
  match_number integer,
  round_number integer,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  is_closed boolean not null default false,
  home_score integer,
  away_score integer,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_score is null or home_score >= 0),
  check (away_score is null or away_score >= 0),
  check (match_number is null or match_number > 0),
  check (round_number is null or round_number > 0)
);

alter table public.matches
  add column if not exists is_closed boolean not null default false;

alter table public.matches
  add column if not exists match_number integer;

alter table public.matches
  add column if not exists round_number integer;

create unique index if not exists idx_matches_match_number
  on public.matches (match_number);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, match_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_predictions_updated_at on public.predictions;
create trigger trg_predictions_updated_at
before update on public.predictions
for each row
execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "matches_select_all_authenticated" on public.matches;
create policy "matches_select_all_authenticated"
on public.matches
for select
to authenticated
using (true);

drop policy if exists "matches_admin_update" on public.matches;
create policy "matches_admin_update"
on public.matches
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "matches_admin_insert" on public.matches;
create policy "matches_admin_insert"
on public.matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists "predictions_select_all_authenticated" on public.predictions;
create policy "predictions_select_all_authenticated"
on public.predictions
for select
to authenticated
using (true);

drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff"
on public.predictions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
      and m.is_closed = false
  )
);

drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff"
on public.predictions
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
      and m.is_closed = false
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
      and m.is_closed = false
  )
);

drop policy if exists "predictions_delete_own_before_kickoff" on public.predictions;
create policy "predictions_delete_own_before_kickoff"
on public.predictions
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
      and m.is_closed = false
  )
);

create or replace view public.leaderboard as
with scored as (
  select
    p.user_id,
    p.match_id,
    case
      when p.home_goals = m.home_score and p.away_goals = m.away_score then 10
      when
        (
          (p.home_goals > p.away_goals and m.home_score > m.away_score)
          or (p.home_goals < p.away_goals and m.home_score < m.away_score)
        )
        and (p.home_goals - p.away_goals) = (m.home_score - m.away_score)
        then 7
      when
        (p.home_goals > p.away_goals and m.home_score > m.away_score)
        or (p.home_goals < p.away_goals and m.home_score < m.away_score)
        or (p.home_goals = p.away_goals and m.home_score = m.away_score)
        then 5
      when p.home_goals = m.home_score or p.away_goals = m.away_score then 1
      else 0
    end as points,
    case when p.home_goals = m.home_score and p.away_goals = m.away_score then 1 else 0 end as exact_scores,
    case
      when
        (p.home_goals > p.away_goals and m.home_score > m.away_score)
        or (p.home_goals < p.away_goals and m.home_score < m.away_score)
        or (p.home_goals = p.away_goals and m.home_score = m.away_score)
      then 1
      else 0
    end as result_hits,
    case
      when
        (
          (p.home_goals > p.away_goals and m.home_score > m.away_score)
          or (p.home_goals < p.away_goals and m.home_score < m.away_score)
        )
        and (p.home_goals - p.away_goals) = (m.home_score - m.away_score)
      then 1
      else 0
    end as goal_diff_hits,
    case
      when
        not (
          (p.home_goals > p.away_goals and m.home_score > m.away_score)
          or (p.home_goals < p.away_goals and m.home_score < m.away_score)
          or (p.home_goals = p.away_goals and m.home_score = m.away_score)
        )
        and (p.home_goals = m.home_score or p.away_goals = m.away_score)
      then 1
      else 0
    end as one_team_goal_hits
  from public.predictions p
  join public.matches m on m.id = p.match_id
  where m.home_score is not null
    and m.away_score is not null
)
select
  pr.id as user_id,
  pr.display_name,
  coalesce(sum(s.points), 0)::int as total_points,
  coalesce(sum(s.exact_scores), 0)::int as exact_scores,
  coalesce(sum(s.result_hits), 0)::int as result_hits,
  coalesce(sum(s.goal_diff_hits), 0)::int as goal_diff_hits,
  coalesce(sum(s.one_team_goal_hits), 0)::int as one_team_goal_hits,
  coalesce(count(s.match_id), 0)::int as predictions_count
from public.profiles pr
left join scored s on s.user_id = pr.id
where pr.is_active = true
group by pr.id, pr.display_name
order by total_points desc, exact_scores desc, result_hits desc, pr.display_name asc;

grant select on public.leaderboard to authenticated;
