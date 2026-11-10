import type { TimeSlotValue } from '@repo/ui';
import { toDateTime } from './toTimeRange';

/** 予約の画面 (screens.yaml の ReserveRoom の route) */
export const RESERVE_ROOM_PATH = '/reservations/new';

/**
 * 照会した時間帯が過去か (開始が現在より前)。過去なら「予約する」を出さない (Screens/RoomAvailability の見本 PastSlot)。
 * 開始が現在と同じなら過去にしない (予約の受入基準「開始時刻が現在と同じ時間帯は予約できる」と同じ境界)。
 * 表示を決めるだけで、予約できるかの判定は API が行う。日時に読めない時間帯は過去にしない
 */
export function isPastSlot(slot: TimeSlotValue, now: Date): boolean {
  const start = Date.parse(toDateTime(slot.date, slot.startTime));
  return !Number.isNaN(start) && start < now.getTime();
}

/**
 * 空き状況から予約の画面へ移る先の path。選んだ会議室と照会した日付・時間帯をクエリで渡す (ADR 0021)。
 * クエリは URLSearchParams で組み立てる
 */
export function reserveRoomPath(roomId: string, slot: TimeSlotValue): string {
  const query = new URLSearchParams({
    roomId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  });
  return `${RESERVE_ROOM_PATH}?${query.toString()}`;
}
