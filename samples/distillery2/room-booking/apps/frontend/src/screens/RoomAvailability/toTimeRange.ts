import type { TimeSlotValue } from '@repo/ui';
import type { TimeRange } from '../../../../../packages/contracts/api/types';

import { businessWallToInstantMs, formatBusinessDateTime } from '../businessTimeZone';

/**
 * 形の読めない値をそのまま送るときに付ける時差。
 * API は形の誤り (VALIDATION_ERROR) で返すので、時差の規則は判定に効かない
 */
const RAW_OFFSET = '+09:00';
const HOURS_PER_DAY = 24;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** 翌日の時刻として読む時の上限 (この値未満。47:59 まで = 翌日 23:59 まで) */
const MAX_HOUR = HOURS_PER_DAY * 2;
const MINUTES_PER_HOUR = 60;

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 暦にある日付か (月は 1〜12、日はその月の日数まで) */
function isCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const days = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}

/**
 * 日付と時刻 (HH:mm、日本時間) を時差付きの日時 (RFC 3339) にする。
 * 時差は固定にせず、その日時の Asia/Tokyo の時差の規則で決める (過去の夏時間の日は +10:00)。
 * 24 時以降の時刻は翌日の日時にする (24:00 は翌日 0:00、25:00 は翌日 1:00。ADR 0017: 終了の 24:00 は翌日 0:00 の日時で持つ)。
 * 形の読めない値 (暦に無い日付・60 分以上の分・48 時以上の時を含む) は別の日時に正規化せず、
 * そのまま組み立てて送り、判定は API に任せる (VALIDATION_ERROR)。
 */
export function toDateTime(date: string, time: string): string {
  const raw = `${date}T${time}:00${RAW_OFFSET}`;
  const d = DATE_PATTERN.exec(date);
  const t = TIME_PATTERN.exec(time);
  if (!d || !t) return raw;
  const [y, m, dd] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (!isCalendarDate(y, m, dd) || minute >= MINUTES_PER_HOUR || hour >= MAX_HOUR) return raw;
  const instant = businessWallToInstantMs({ year: y, month: m, day: dd, hour, minute, second: 0 });
  return formatBusinessDateTime(instant);
}

/** 画面の時間帯の入力値を、契約の時間帯 (開始と終了の日時) にする。日付を別の項目で送らない (ADR 0017) */
export function toTimeRange(slot: TimeSlotValue): TimeRange {
  return {
    startAt: toDateTime(slot.date, slot.startTime),
    endAt: toDateTime(slot.date, slot.endTime),
  };
}
