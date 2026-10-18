-- Memory Match (games/memory.html, all ages: Little ones, Words EN/ES, Classic, Daily board, Two players).
-- ig_start_game refuses game ids missing from the catalog ('unknown_game'), so signed-in rounds need this row.
-- Its save key 'inoa.memory' holds only best scores, sticker indexes, word-mode choices and the daily streak (no names).
insert into public.ig_game_catalog (game_id, name, sort_order, is_active) values ('memory', 'Memory Match', 17, true) on conflict (game_id) do update set is_active = true;
