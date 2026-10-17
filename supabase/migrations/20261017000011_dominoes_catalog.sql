-- Dominoes (games/dominoes.html), the first Card Room game (docs/DECISIONS/0004-card-room.md).
-- ig_start_game refuses game ids missing from the catalog ('unknown_game'); 0009 added the row inactive until the page shipped.
insert into public.ig_game_catalog (game_id, name, sort_order, is_active) values ('dominoes', 'Dominoes', 14, true)
  on conflict (game_id) do update set is_active = true;
