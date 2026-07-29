// 出典: _cross-cutting/datastore/rdb-schema.yaml reservations テーブル
// pending: 予約受付中(キュー待ち) / reserved: 予約確保済(取り置き中) / cancelled: キャンセル済
// fulfilled: 完了(貸出実行により終了。attempt-3 で追加)
// 出典: spec.md 状態遷移一覧「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」。
// rdb-schema.yaml の reservations.status の説明列挙(pending/reserved/cancelled)には
// 「完了」に相当する値が無く、この値は仕様との矛盾がある状態で追加した
// (docs/impl/latest/19ec0182/issues/ に起票済み)。

export type ReservationStatus =
  | "pending"
  | "reserved"
  | "cancelled"
  | "fulfilled";

export interface Reservation {
  id: string;
  bookId: string;
  userId: string;
  status: ReservationStatus;
  queuePosition: number;
}
