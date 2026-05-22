insert into public.profiles (id, email, username, display_name, is_admin, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'ana@bolao.dev', 'ana', 'Ana', true, true),
  ('22222222-2222-4222-8222-222222222222', 'bruno@bolao.dev', 'bruno', 'Bruno', false, true),
  ('33333333-3333-4333-8333-333333333333', 'carla@bolao.dev', 'carla', 'Carla', false, true),
  ('44444444-4444-4444-8444-444444444444', 'diego@bolao.dev', 'diego', 'Diego', false, true),
  ('55555555-5555-4555-8555-555555555555', 'elis@bolao.dev', 'elis', 'Elis', false, true)
on conflict (id) do update
set
  email = excluded.email,
  username = excluded.username,
  display_name = excluded.display_name,
  is_admin = excluded.is_admin,
  is_active = excluded.is_active;

insert into public.matches (
  id,
  stage,
  group_name,
  home_team,
  away_team,
  kickoff_at,
  is_closed,
  home_score,
  away_score,
  venue
)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'group', 'A', 'Brasil', 'Canadá', '2026-05-10T18:00:00Z', true, 2, 1, 'Toronto Stadium'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'group', 'A', 'México', 'Japão', '2026-05-11T21:00:00Z', true, 1, 1, 'Monterrey Arena'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'group', 'B', 'Alemanha', 'Estados Unidos', '2026-06-11T19:00:00Z', false, null, null, 'Seattle Field'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'group', 'B', 'França', 'Argentina', '2026-06-12T22:00:00Z', false, null, null, 'Houston Stadium'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'group', 'C', 'Espanha', 'Inglaterra', '2026-06-13T20:00:00Z', false, null, null, 'Vancouver Dome'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'group', 'C', 'Holanda', 'Uruguai', '2026-06-14T17:00:00Z', false, null, null, 'Miami Park')
on conflict (id) do update
set
  stage = excluded.stage,
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  kickoff_at = excluded.kickoff_at,
  is_closed = excluded.is_closed,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  venue = excluded.venue;

insert into public.predictions (id, user_id, match_id, home_goals, away_goals)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 2, 1),
  ('bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 0, 0),
  ('bbbbbbbb-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 3, 2),
  ('bbbbbbbb-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000002', 1, 1),
  ('bbbbbbbb-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000001', 2, 0),
  ('bbbbbbbb-0000-4000-8000-000000000006', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000002', 2, 1),
  ('bbbbbbbb-0000-4000-8000-000000000007', '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-0000-4000-8000-000000000001', 0, 2),
  ('bbbbbbbb-0000-4000-8000-000000000008', '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-0000-4000-8000-000000000002', 1, 2)
on conflict (id) do update
set
  user_id = excluded.user_id,
  match_id = excluded.match_id,
  home_goals = excluded.home_goals,
  away_goals = excluded.away_goals;
