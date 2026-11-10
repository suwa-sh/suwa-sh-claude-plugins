import type { TimeSlotValue } from '@repo/ui';
import { businessWallClock, formatDate } from '../businessTimeZone';

/** 最初に表示する時間帯の時刻 (照会の前に利用者が選び直す前提の初期値) */
export const INITIAL_START_TIME = '09:00';
export const INITIAL_END_TIME = '10:00';

/** 画面を開いたときの時間帯の初期値: 今日 (Asia/Tokyo の日付。時差は Asia/Tokyo の規則で決める) の 9:00〜10:00 */
export function initialSlot(now: Date): TimeSlotValue {
  const date = formatDate(businessWallClock(now.getTime()));
  return { date, startTime: INITIAL_START_TIME, endTime: INITIAL_END_TIME };
}
