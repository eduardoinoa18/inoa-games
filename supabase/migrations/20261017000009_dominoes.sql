-- Dominoes (games/dominoes.html), the first Card Room game (docs/DECISIONS/0004-card-room.md).
-- ig_start_game refuses game ids missing from the catalog ('unknown_game'), so signed-in players need this row to play.
insert into public.ig_game_catalog (game_id, name, sort_order) values ('dominoes', 'Dominoes', 14)
  on conflict (game_id) do nothing;
