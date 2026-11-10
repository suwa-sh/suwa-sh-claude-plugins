import { endTimes, type ReservationFormValue, type Room, startTimes } from '@repo/ui';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 暦にある日付 (YYYY-MM-DD) か */
function isCalendarDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** 選択肢にある値ならそのまま、無ければ空 (既定のまま) にする */
const oneOf = (value: string | undefined, options: readonly string[]) =>
  value !== undefined && options.includes(value) ? value : '';

/**
 * 移ってきたときのクエリ (roomId・date・startTime・endTime) から、予約の入力の初期値を作る (ADR 0021)。
 * 入力の形に合わない項目 (日付の書式でない・時刻の選択肢に無い) は空のままにし、エラーも遷移もしない。
 * 会議室は選択肢を読んだ後に {@link keepKnownRoom} で確かめる。業務の検証 (過去・時間帯の範囲) は API に任せる
 */
export function initialReservationValue(query: Record<string, string>): ReservationFormValue {
  return {
    roomId: query.roomId ?? '',
    date: query.date !== undefined && isCalendarDate(query.date) ? query.date : '',
    startTime: oneOf(query.startTime, startTimes()),
    endTime: oneOf(query.endTime, endTimes()),
  };
}

/** 会議室の選択肢に無い会議室 ID は空にする (選択肢に無い会議室は引き継がない) */
export function keepKnownRoom(value: ReservationFormValue, rooms: Room[]): ReservationFormValue {
  if (value.roomId === '' || rooms.some((r) => r.roomId === value.roomId)) return value;
  return { ...value, roomId: '' };
}
