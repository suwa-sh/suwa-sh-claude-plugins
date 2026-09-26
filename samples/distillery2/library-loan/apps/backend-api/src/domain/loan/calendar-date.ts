/**
 * 暦日 (時刻を持たない日付) の値。契約 (Loan.loanedOn / Loan.dueDate) の `format: date` と同じ `YYYY-MM-DD` で表す。
 */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseCalendarDate(value: string): number {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`暦日は YYYY-MM-DD 形式で指定してください: ${value}`);
  }
  const [, year, month, day] = match;
  const epoch = Date.UTC(Number(year), Number(month) - 1, Number(day));
  if (new Date(epoch).toISOString().slice(0, 10) !== value) {
    throw new RangeError(`存在しない暦日です: ${value}`);
  }
  return epoch;
}

/** 暦日に日数を加えた暦日を返す (月末・年末・うるう年をまたいでも暦どおりに進む)。 */
export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError(`日数は整数で指定してください: ${days}`);
  }
  const epoch = parseCalendarDate(date);
  return new Date(epoch + days * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

/** 時点を、指定したタイムゾーンでの暦日に変換する。 */
export function toCalendarDate(instant: Date, timeZone: string): string {
  // en-CA ロケールは YYYY-MM-DD で日付を書式化する
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
