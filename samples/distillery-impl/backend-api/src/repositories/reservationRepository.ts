import type { Reservation } from "../domain/reservation";

// 出典: _cross-cutting/datastore/rdb-schema.yaml reservations テーブル
// idx_reservations_book_id_status(コメント「返却時の予約チェック用」)に沿い、
// book_id + status で有効な予約(cancelled・fulfilled を除く)を絞り込むクエリだけを公開する。
export interface ReservationRepository {
  /** 指定書籍に対する有効な予約(status が pending または reserved のもの)を返す */
  findActiveByBookId(bookId: string): Reservation[];
  /**
   * 出典: spec.md 状態遷移一覧「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」。
   * 指定書籍・利用者の予約確保済(reserved)レコードを完了(fulfilled)に更新する。
   * 該当する予約が無い場合(通常貸出で予約自体が存在しないケース)は何もしない。
   */
  completeReservedByBookIdAndUserId(bookId: string, userId: string): void;
}

export class InMemoryReservationRepository implements ReservationRepository {
  private readonly reservations = new Map<string, Reservation>();

  seed(reservation: Reservation): void {
    this.reservations.set(reservation.id, reservation);
  }

  findActiveByBookId(bookId: string): Reservation[] {
    return [...this.reservations.values()].filter(
      (reservation) =>
        reservation.bookId === bookId &&
        (reservation.status === "pending" || reservation.status === "reserved"),
    );
  }

  completeReservedByBookIdAndUserId(bookId: string, userId: string): void {
    for (const reservation of this.reservations.values()) {
      if (
        reservation.bookId === bookId &&
        reservation.userId === userId &&
        reservation.status === "reserved"
      ) {
        this.reservations.set(reservation.id, {
          ...reservation,
          status: "fulfilled",
        });
      }
    }
  }
}
