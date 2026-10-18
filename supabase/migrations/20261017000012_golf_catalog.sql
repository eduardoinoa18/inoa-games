-- Six-Card Golf (games/golf.html), the second Card Room game (docs/DECISIONS/0004-card-room.md).
-- ig_start_game refuses game ids missing from the catalog ('unknown_game').
insert into public.ig_game_catalog (game_id, name, sort_order, is_active) values ('golf', 'Six-Card Golf', 16, true) on conflict (game_id) do update set is_active = true;
