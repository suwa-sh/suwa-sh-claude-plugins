/**
 * 条件「返却期限算出」: 返却期限 = 貸出日 + 貸出期間 (日数)。
 * 日付は 'YYYY-MM-DD' の暦日で扱い、時刻・タイムゾーンを持ち込まない (契約 Loan.due_on / loaned_on は format: date)。
 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export class InvalidCalendarDateError extends Error {
  constructor(value: string) {
    super(`暦日の形式 (YYYY-MM-DD) ではありません: ${value}`);
    this.name = 'InvalidCalendarDateError';
  }
}

function toEpochDay(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new InvalidCalendarDateError(date);
  const [, y, m, d] = match;
  const millis = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const roundTrip = new Date(millis).toISOString().slice(0, 10);
  if (roundTrip !== date) throw new InvalidCalendarDateError(date);
  return millis / MILLIS_PER_DAY;
}

function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * MILLIS_PER_DAY).toISOString().slice(0, 10);
}

/** 貸出日に貸出期間を加えた返却期限を返す (月・年をまたいでも暦どおりに進める)。 */
export function calculateDueOn(loanedOn: string, loanPeriodDays: number): string {
  if (!Number.isInteger(loanPeriodDays) || loanPeriodDays <= 0) {
    throw new RangeError(`貸出期間は 1 以上の整数日である必要があります: ${loanPeriodDays}`);
  }
  return fromEpochDay(toEpochDay(loanedOn) + loanPeriodDays);
}
