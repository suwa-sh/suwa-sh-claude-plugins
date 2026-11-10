/**
 * 画面部品が受け取るデータの形。契約 (contracts/openapi/openapi.yaml) の enum と同じ値を使う。
 * 日時の整形 (RFC 3339 -> 日付・HH:mm) は frontend 側で行い、部品には表示用の文字列を渡す。
 */

/** 空き状況。available = 空き / reserved = 予約済み */
export type Availability = 'available' | 'reserved';

/** 予約状態。reserved = 予約済み / cancelled = 取消済み */
export type ReservationStatus = 'reserved' | 'cancelled';

/** 契約の ErrorCode */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_TIME_RANGE'
  | 'NOT_ON_30_MINUTES'
  | 'PAST_TIME_SLOT'
  | 'SLOT_OVERLAPS'
  | 'ALREADY_CANCELLED'
  | 'CANCEL_DEADLINE_PASSED'
  | 'NOT_RESERVATION_OWNER'
  | 'RESERVATION_NOT_FOUND'
  | 'ROOM_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface Room {
  roomId: string;
  name: string;
}

export interface RoomAvailabilityItem {
  roomId: string;
  roomName: string;
  availability: Availability;
}

/** 表示用の予約 (日付は YYYY-MM-DD、時刻は HH:mm) */
export interface ReservationView {
  reservationId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

/** 時間帯の入力値 (日付は YYYY-MM-DD、時刻は HH:mm) */
export interface TimeSlotValue {
  date: string;
  startTime: string;
  endTime: string;
}
