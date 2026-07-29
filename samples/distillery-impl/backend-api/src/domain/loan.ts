import type { Book } from "./book";
import type { Reservation } from "./reservation";

// 出典: tier-backend-api.md ビジネスルール「貸出可否判定ルール」
// 書籍の status が "available" かつ、その書籍に対する予約受付中の予約がない場合に貸出可能。
// ただし予約者本人（予約確保済）の場合は貸出可能。
//
// reservations.status(pending/reserved/cancelled)への対応関係は tier-backend-api.md に
// 明記が無いため、以下の解釈で実装した(仕様欠落として issues/ に起票済み):
// 「予約受付中の予約」= 有効な予約(status が pending または reserved)全体
// 「予約者本人（予約確保済）」= 有効な予約のうち status が reserved かつ userId が一致するもの
// activeReservations は ReservationRepository.findActiveByBookId が返す
// cancelled 除外済みの一覧を渡す前提(cancelled のフィルタはリポジトリ層の責務)。
export function canLend(
  book: Pick<Book, "status">,
  userId: string,
  activeReservations: readonly Pick<Reservation, "userId" | "status">[],
): boolean {
  if (book.status !== "available") {
    return false;
  }
  if (activeReservations.length === 0) {
    return true;
  }
  return activeReservations.some(
    (reservation) =>
      reservation.status === "reserved" && reservation.userId === userId,
  );
}

// 出典: tier-backend-api.md ビジネスルール「貸出期限ルール」貸出日 + 14日
const LOAN_PERIOD_DAYS = 14;

export function calculateDueDate(loanDate: Date): Date {
  const dueDate = new Date(loanDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + LOAN_PERIOD_DAYS);
  return dueDate;
}
