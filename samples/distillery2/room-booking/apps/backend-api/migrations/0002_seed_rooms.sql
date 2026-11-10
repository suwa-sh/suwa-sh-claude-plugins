-- 手書きの migration (生成物ではない)。会議室 5 部屋の初期データ (ADR 0003: 会議室は migration の初期データで入れる)。
-- 名前と ID は仮置き (会議室A〜E、room-1〜room-5、表示順 1〜5)。契約 viewRoomAvailability の 200 の例と同じ値。
-- 二重に当てても失敗しない。
INSERT INTO "rooms" ("room_id", "room_name", "display_order") VALUES
  ('room-1', '会議室A', 1),
  ('room-2', '会議室B', 2),
  ('room-3', '会議室C', 3),
  ('room-4', '会議室D', 4),
  ('room-5', '会議室E', 5)
ON CONFLICT ("room_id") DO NOTHING;
