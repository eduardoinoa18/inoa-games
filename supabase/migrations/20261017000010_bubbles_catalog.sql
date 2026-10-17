-- Bubble Pop Counting (games/bubbles.html, ages 3–6): add it to the game catalog so signed-in rounds (ig_finish_round) count.
-- Its save key 'inoa.bubbles' holds only stars + sticker indexes (no names, no personal data); see engine/savekeys.js.
insert into public.ig_game_catalog (game_id, name, sort_order) values ('bubbles', 'Bubble Pop Counting', 15)
on conflict (game_id) do nothing;
