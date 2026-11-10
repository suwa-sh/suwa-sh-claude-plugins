import type { RoomId } from './ids';
import type { TimeRange } from './timeRange';

/** 空き状況。available = 空き / reserved = 予約済み (重なる有効な予約がある) */
export type Availability = 'available' | 'reserved';

/** 予約状態 (状態.tsv の予約状態。reserved = 予約済み / cancelled = 取消済み) */
export type ReservationStatus = 'reserved' | 'cancelled';

/** 空きの判定に使う予約の時間帯と状態 (予約者は持たない。ADR 0006: 空き状況に予約者を含めない) */
export interface ReservedSlot {
  roomId: RoomId;
  startAt: Date;
  endAt: Date;
  status: ReservationStatus;
}

/**
 * 会議室の空き状況を判定する。指定した時間帯に半開区間で重なる予約済みの予約があれば予約済み、無ければ空き。
 * 取消済みの予約は数えない (条件「予約の重なり判定」)。空きは予約できることまでは示さない。
 */
export function judgeAvailability(
  roomId: RoomId,
  range: TimeRange,
  reservations: readonly ReservedSlot[],
): Availability {
  const occupied = reservations.some(
    (r) => r.status === 'reserved' && r.roomId.equals(roomId) && range.overlaps(r),
  );
  return occupied ? 'reserved' : 'available';
}
