create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key,
  email text not null unique,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users
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
  from public.app_users
  where username is null or btrim(username) = ''
),
ranked as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as rn
  from generated
)
update public.app_users u
set username =
  case
    when r.rn = 1 then r.base
    else r.base || r.rn::text
  end
from ranked r
where u.id = r.id;

create unique index if not exists idx_app_users_username_ci
  on public.app_users ((lower(username)));

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

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
  predictions_closed_at timestamptz,
  prediction_warning_sent_at timestamptz,
  external_provider text,
  external_match_id text,
  external_mapping_checked_at timestamptz,
  live_status text,
  result_synced_at timestamptz,
  result_score_basis text,
  result_notified_at timestamptz,
  qualified_side text check (qualified_side is null or qualified_side in ('home', 'away')),
  bets_settled_at timestamptz,
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
  add column if not exists match_number integer;

alter table public.matches
  add column if not exists round_number integer;

alter table public.matches
  add column if not exists predictions_closed_at timestamptz;

alter table public.matches
  add column if not exists prediction_warning_sent_at timestamptz;

alter table public.matches
  add column if not exists external_provider text;

alter table public.matches
  add column if not exists external_match_id text;

alter table public.matches
  add column if not exists external_mapping_checked_at timestamptz;

alter table public.matches
  add column if not exists live_status text;

alter table public.matches
  add column if not exists result_synced_at timestamptz;

alter table public.matches
  add column if not exists result_score_basis text;

alter table public.matches
  add column if not exists result_notified_at timestamptz;

alter table public.matches
  add column if not exists qualified_side text;

alter table public.matches
  add column if not exists bets_settled_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_qualified_side_check'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_qualified_side_check
      check (qualified_side is null or qualified_side in ('home', 'away'));
  end if;
end;
$$;

create unique index if not exists idx_matches_match_number
  on public.matches (match_number);

create unique index if not exists idx_matches_external_match
  on public.matches (external_provider, external_match_id)
  where external_provider is not null and external_match_id is not null;

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, match_id)
);

create table if not exists public.qualification_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  selected_side text not null check (selected_side in ('home', 'away')),
  stake integer not null constraint qualification_bets_min_stake_check
    check (stake >= 10),
  status text not null default 'active' check (
    status in ('active', 'cancelled', 'won', 'lost', 'refunded')
  ),
  payout integer not null default 0 check (payout >= 0),
  cancelled_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, match_id)
);

create index if not exists idx_qualification_bets_match_status
  on public.qualification_bets (match_id, status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'qualification_bets_min_stake_check'
      and conrelid = 'public.qualification_bets'::regclass
  ) then
    alter table public.qualification_bets
      add constraint qualification_bets_min_stake_check
      check (stake >= 10) not valid;
  end if;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row
execute function public.touch_updated_at();

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

drop trigger if exists trg_qualification_bets_updated_at on public.qualification_bets;
create trigger trg_qualification_bets_updated_at
before update on public.qualification_bets
for each row
execute function public.touch_updated_at();

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
    case
      when p.home_goals = m.home_score and p.away_goals = m.away_score then 1
      else 0
    end as exact_scores,
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
),
prediction_totals as (
  select
    user_id,
    coalesce(sum(points), 0)::int as prediction_points,
    coalesce(sum(exact_scores), 0)::int as exact_scores,
    coalesce(sum(result_hits), 0)::int as result_hits,
    coalesce(sum(goal_diff_hits), 0)::int as goal_diff_hits,
    coalesce(sum(one_team_goal_hits), 0)::int as one_team_goal_hits,
    coalesce(count(match_id), 0)::int as predictions_count
  from scored
  group by user_id
),
bet_totals as (
  select
    user_id,
    coalesce(sum(
      case
        when status = 'active' then -stake
        when status = 'lost' then -stake
        when status = 'won' then payout - stake
        else 0
      end
    ), 0)::int as bet_points,
    coalesce(sum(case when status = 'active' then stake else 0 end), 0)::int as active_stakes
  from public.qualification_bets
  group by user_id
)
select
  u.id as user_id,
  u.display_name,
  greatest(
    0,
    coalesce(pt.prediction_points, 0) + coalesce(bt.bet_points, 0)
  )::int as total_points,
  coalesce(pt.exact_scores, 0)::int as exact_scores,
  coalesce(pt.result_hits, 0)::int as result_hits,
  coalesce(pt.goal_diff_hits, 0)::int as goal_diff_hits,
  coalesce(pt.predictions_count, 0)::int as predictions_count,
  coalesce(pt.one_team_goal_hits, 0)::int as one_team_goal_hits,
  coalesce(pt.prediction_points, 0)::int as prediction_points,
  coalesce(bt.bet_points, 0)::int as bet_points,
  coalesce(bt.active_stakes, 0)::int as active_stakes
from public.app_users u
left join prediction_totals pt on pt.user_id = u.id
left join bet_totals bt on bt.user_id = u.id
where u.is_active = true
order by
  total_points desc,
  exact_scores desc,
  goal_diff_hits desc,
  result_hits desc,
  bet_points desc,
  u.display_name asc;

insert into public.app_users (
  id,
  email,
  username,
  display_name,
  password_hash,
  is_admin,
  is_active,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'ana@bolao.dev',
    'ana',
    'Ana',
    '58a2acd26fbde5287ec11a67134ff1fb:da491d86d315a859a112a876ae5ae3339a60876f147a44d4607c6a9a5ad9c17eeeb4a6458fa0dff4b9fd9f402b57e36b70e7f6a759b07200b76509cc680db847',
    true,
    true,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'bruno@bolao.dev',
    'bruno',
    'Bruno',
    '58a2acd26fbde5287ec11a67134ff1fb:da491d86d315a859a112a876ae5ae3339a60876f147a44d4607c6a9a5ad9c17eeeb4a6458fa0dff4b9fd9f402b57e36b70e7f6a759b07200b76509cc680db847',
    false,
    true,
    now(),
    now()
  )
on conflict (id) do update
set
  email = excluded.email,
  username = excluded.username,
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  is_admin = excluded.is_admin,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.matches (
  id,
  stage,
  group_name,
  match_number,
  round_number,
  home_team,
  away_team,
  kickoff_at,
  is_closed,
  home_score,
  away_score,
  venue,
  created_at,
  updated_at
)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'group', 'A', 1, 1, 'Brasil', 'Canadá', '2026-05-10T18:00:00Z', true, 2, 1, 'Toronto Stadium', now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'group', 'A', 2, 1, 'México', 'Japão', '2026-05-11T21:00:00Z', true, 1, 1, 'Monterrey Arena', now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'group', 'B', 3, 1, 'Alemanha', 'Estados Unidos', '2026-06-11T19:00:00Z', false, null, null, 'Seattle Field', now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'group', 'B', 4, 1, 'França', 'Argentina', '2026-06-12T22:00:00Z', false, null, null, 'Houston Stadium', now(), now())
on conflict (id) do update
set
  stage = excluded.stage,
  group_name = excluded.group_name,
  match_number = excluded.match_number,
  round_number = excluded.round_number,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  kickoff_at = excluded.kickoff_at,
  is_closed = excluded.is_closed,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  venue = excluded.venue,
  updated_at = now();

insert into public.predictions (id, user_id, match_id, home_goals, away_goals, created_at, updated_at)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 2, 1, now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 0, 0, now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 3, 2, now(), now())
on conflict (id) do update
set
  user_id = excluded.user_id,
  match_id = excluded.match_id,
  home_goals = excluded.home_goals,
  away_goals = excluded.away_goals,
  updated_at = now();
