/**
 * 業務日付 (YYYY-MM-DD)。契約の format: date (loanedOn / dueOn) と DB の date 列に合わせ、時刻を持たない。
 */
export type BusinessDate = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isBusinessDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return date.toISOString().slice(0, 10) === value;
}

/** 業務日付に日数を加える。暦日で数え、タイムゾーンの影響を受けないよう UTC で計算する。 */
export function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!isBusinessDate(date)) throw new RangeError(`業務日付の形式が正しくありません: ${date}`);
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, mo - 1, d);
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 業務日付を返す時計。テストでは固定日付に差し替える (ADR 0007)。 */
export interface Clock {
  today(): BusinessDate;
  now(): Date;
}
