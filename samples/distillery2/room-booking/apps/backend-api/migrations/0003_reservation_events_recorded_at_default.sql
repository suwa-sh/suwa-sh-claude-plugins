-- 手書きの migration (生成物ではない)。契約 contracts/db/domains/room_reservation.yaml の reservation_events.recorded_at の
-- 「記録した時刻は DB の既定値 now() で付ける (既定値は手書きの追加 migration で足す)」を当てる。
-- イベントを初めて書く UC (会議室を予約する) の契約の段で足した。二重に当てても失敗しない。
ALTER TABLE "reservation_events" ALTER COLUMN "recorded_at" SET DEFAULT now();
